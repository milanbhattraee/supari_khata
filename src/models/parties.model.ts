import mongoose, { Document, Schema } from "mongoose";

export interface IParties extends Document {
  name: string;
  phone?: string;
}

const PartiesSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String},
  },
  { timestamps: true }
);

const PartiesModel =
  mongoose.models.Parties ||
  mongoose.model<IParties>("Parties", PartiesSchema);

export default PartiesModel;