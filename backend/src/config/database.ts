import dotenv from "dotenv";
dotenv.config()
import mongoose from "mongoose";

const LIVE_ATLAS_URL = "mongodb://mdshahidwithlove_db_user:FrBHD9olCcxmyfli@ac-x4q02ga-shard-00-00.71zpwkb.mongodb.net:27017,ac-x4q02ga-shard-00-01.71zpwkb.mongodb.net:27017,ac-x4q02ga-shard-00-02.71zpwkb.mongodb.net:27017/locals?ssl=true&replicaSet=atlas-11x5ff-shard-0&authSource=admin&appName=Cluster0";

function connectDatabase(): Promise<typeof mongoose> {
    const dbUrl = process.env.DB_URL || LIVE_ATLAS_URL;
    return mongoose.connect(dbUrl);
}

export { connectDatabase };