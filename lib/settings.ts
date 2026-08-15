import { getDb } from "./db";

export interface EditableSettingsFields {
  companyName: string;
  addressLines: string[];
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  gstin: string;
  /** Place of supply — decides CGST+SGST vs IGST on a tax invoice. */
  stateName: string;
  stateCode: string;
  defaultHsnSac: string;
  bank: {
    accountName: string;
    bankName: string;
    accountNo: string;
    ifsc: string;
    branch: string;
    upiName: string;
    upiPhone: string;
  };
}

export async function updateSettingsFields(fields: EditableSettingsFields) {
  const db = await getDb();
  await db.collection("settings").updateOne({}, { $set: fields });
}
