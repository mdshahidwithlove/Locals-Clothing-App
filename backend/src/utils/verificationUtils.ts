import UserModel from '../Models/userModel';
import StoreModel from '../Models/storeModel';
import ProductModel from '../Models/productModel';
import OrderModel from '../Models/orderModel';
import DeliveryModel from '../Models/deliveryModel';
import type { VerificationStatus } from '../types/verification';

type UserLike = {
  _id?: unknown;
  role?: string;
  isProfileComplete?: boolean;
  verificationStatus?: VerificationStatus;
  verificationGrandfathered?: boolean;
  verificationSubmittedAt?: Date | string | null;
  verificationDocuments?: unknown[];
  createdAt?: Date | string;
};

/** Accounts / stores created before this date skip document verification (existing users). */
function getVerificationEpoch(): Date {
  const env = process.env.VERIFICATION_REQUIRED_SINCE;
  if (env) {
    const parsed = new Date(env);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

const ESTABLISHED_ACCOUNT_MS = 30 * 60 * 1000; // 30 minutes — new signups verify sooner

function hasVerificationSubmission(user: UserLike): boolean {
  return (
    !!user.verificationSubmittedAt ||
    (Array.isArray(user.verificationDocuments) && user.verificationDocuments.length > 0)
  );
}

/** Resolve effective verification status (grandfathers existing merchants/delivery partners). */
export function resolveVerificationStatus(user: UserLike): VerificationStatus {
  if (user.verificationGrandfathered) {
    return 'approved';
  }

  if (user.role === 'User') {
    return user.verificationStatus || 'not_required';
  }

  if (user.role !== 'Merchant' && user.role !== 'Delivery') {
    return 'not_required';
  }

  const raw = user.verificationStatus;

  if (raw === 'pending_review' || raw === 'approved' || raw === 'rejected') {
    return raw;
  }

  // Require explicit documents and approval; no auto-approval based on profile completeness.
  return 'pending_documents';
}

export function requiresVerification(user: UserLike): boolean {
  const status = resolveVerificationStatus(user);
  return user.role === 'Merchant' || user.role === 'Delivery'
    ? status !== 'not_required' && status !== 'approved'
    : false;
}

export function isVerificationApproved(user: UserLike): boolean {
  if (user.role === 'User') return true;
  return user.verificationStatus === 'approved';
}

function isExplicitVerificationStatus(status?: VerificationStatus): boolean {
  return (
    status === 'pending_documents' ||
    status === 'pending_review' ||
    status === 'rejected' ||
    status === 'approved'
  );
}

export function verificationFieldsForClient(user: any) {
  const raw = user.verificationStatus as VerificationStatus | undefined;

  // Prefer DB status set by admin or document submit — never override with legacy resolve
  let verificationStatus: VerificationStatus;
  if (isExplicitVerificationStatus(raw)) {
    verificationStatus = raw!;
  } else if (user.verificationGrandfathered) {
    verificationStatus = 'approved';
  } else {
    verificationStatus = resolveVerificationStatus(user);
  }

  return {
    verificationStatus,
    verificationGrandfathered: !!user.verificationGrandfathered,
    verificationDocuments: user.verificationDocuments || [],
    verificationSubmittedAt: user.verificationSubmittedAt ?? null,
    verificationReviewedAt: user.verificationReviewedAt ?? null,
    verificationReviewNote: user.verificationReviewNote ?? null,
  };
}

/** Auto-approve merchants/delivery who existed before identity verification was required. */
export async function maybeGrandfatherVerification(user: any): Promise<any> {
  if (!user?._id) return user;
  if (user.role !== 'Merchant' && user.role !== 'Delivery') return user;
  if (!user.isProfileComplete) return user;
  if (hasVerificationSubmission(user)) return user;

  if (user.verificationGrandfathered) {
    if (user.verificationStatus !== 'approved') {
      const synced = await UserModel.findByIdAndUpdate(
        user._id,
        { verificationStatus: 'approved' },
        { returnDocument: 'after' },
      );
      return synced ?? user;
    }
    return user;
  }

  const status = user.verificationStatus;
  if (
    status === 'approved' ||
    status === 'pending_review' ||
    status === 'rejected' ||
    status === 'pending_documents'
  ) {
    return user;
  }

  const featureEpoch = getVerificationEpoch();
  let isLegacy = false;

  if (user.role === 'Merchant') {
    const store = await StoreModel.findOne({ merchantId: user._id })
      .select('_id createdAt preVerificationStore')
      .lean();

    if (store) {
      if (store.preVerificationStore) {
        isLegacy = true;
      } else {
        const [productCount, orderCount] = await Promise.all([
          ProductModel.countDocuments({ storeId: store._id }),
          OrderModel.countDocuments({ store: store._id }),
        ]);
        const storeCreated = store.createdAt ? new Date(store.createdAt) : null;
        const storeAgeMs = storeCreated ? Date.now() - storeCreated.getTime() : 0;
        const storePredatesFeature = storeCreated ? storeCreated < featureEpoch : false;
        const establishedStore = storeAgeMs > ESTABLISHED_ACCOUNT_MS;

        isLegacy =
          productCount > 0 ||
          orderCount > 0 ||
          storePredatesFeature ||
          establishedStore;

        if (isLegacy) {
          await StoreModel.updateOne(
            { _id: store._id },
            { preVerificationStore: true },
          );
        }
      }
    }
  } else {
    const deliveryCount = await DeliveryModel.countDocuments({ deliveryPerson: user._id });
    const accountCreated = user.createdAt ? new Date(user.createdAt) : null;
    const accountAgeMs = accountCreated ? Date.now() - accountCreated.getTime() : 0;
    const accountPredatesFeature = accountCreated ? accountCreated < featureEpoch : false;
    const establishedAccount = accountAgeMs > ESTABLISHED_ACCOUNT_MS;

    isLegacy = deliveryCount > 0 || accountPredatesFeature || establishedAccount;
  }

  if (!isLegacy) return user;

  const updated = await UserModel.findByIdAndUpdate(
    user._id,
    {
      verificationStatus: 'approved',
      verificationGrandfathered: true,
      verificationReviewedAt: new Date(),
      verificationReviewNote: 'Grandfathered — account existed before identity verification',
    },
    { returnDocument: 'after' },
  );

  return updated ?? user;
}
