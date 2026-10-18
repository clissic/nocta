import mongoose, { Schema } from "mongoose";

const oauthStateSchema = new Schema({
  state: { type: String, required: true, unique: true },
  provider: { type: String, required: true },
  client: { type: String, required: true },
  returnUrl: { type: String },
  expiresAt: { type: Date, required: true },
});

oauthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthState = mongoose.model("OAuthState", oauthStateSchema);
