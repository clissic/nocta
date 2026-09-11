import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { ENABLED_VENUE_COUNTRIES } from "@nocta/shared";

const appCitySchema = new Schema(
  {
    country: {
      type: String,
      enum: ENABLED_VENUE_COUNTRIES,
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    /** Para unicidad case-insensitive por país. */
    nameNormalized: { type: String, required: true, trim: true, maxlength: 80 },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

appCitySchema.index({ country: 1, nameNormalized: 1 }, { unique: true });
appCitySchema.index({ active: 1, country: 1, name: 1 });

appCitySchema.pre("validate", function (next) {
  if (typeof this.name === "string") {
    this.nameNormalized = this.name.trim().toLowerCase();
  }
  next();
});

export type AppCityDocument = HydratedDocument<
  InferSchemaType<typeof appCitySchema>
>;

export const AppCity = mongoose.model("AppCity", appCitySchema);
