// server/models/Letter.js

import mongoose from "mongoose";

const letterSchema = new mongoose.Schema(
  {
    // Which built-in template was used
    templateType: {
      type:     String,
      enum: ["OFFER_LETTER", "WARNING_LETTER", "APPRECIATION_LETTER", "TERMINATION_LETTER", "EXPERIENCE_LETTER"],
      required: true,
    },

    // Admin's custom text injected into the template
    customText: { type: String, default: "" },

    // The final rendered HTML/text stored so the employee always sees
    // the original even if templates change later
    renderedBody: { type: String, required: true },

    // Subject line shown in the Letters inbox
    subject: { type: String, required: true },

    // Who sent it (admin user _id)
    sentBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    // Which employee receives it
    recipientEmployeeId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Employee",
      required: true,
    },

    // Has the employee opened this letter?
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index for fast employee inbox queries
letterSchema.index({ recipientEmployeeId: 1, createdAt: -1 });

// NEW: fast unread-letter count
letterSchema.index({ recipientEmployeeId: 1, readAt: 1 });

const Letter = mongoose.models.Letter || mongoose.model("Letter", letterSchema);
export default Letter;