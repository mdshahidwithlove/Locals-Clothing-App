import dotenv from "dotenv";
dotenv.config()
import mongoose from "mongoose";

function connectDatabase(): Promise<typeof mongoose> {
    return mongoose.connect(process.env.DB_URL || "");
}

export { connectDatabase };