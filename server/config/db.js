import mongoose from "mongoose"

const cached = global._mongooseCache || (global._mongooseCache = { promise: null })

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 5,
      })
      .then((m) => {
        console.log("MongoDB connected")
        return m.connection
      })
      .catch((err) => {
        cached.promise = null
        throw err
      })
  }

  return cached.promise
}

export default connectDB