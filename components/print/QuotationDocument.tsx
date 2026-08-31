import React from "react";
import type { Quotation, Settings } from "@/models/schemas";
import { DesignSwitcher } from "./DesignSwitcher";

export function QuotationDocument({
  quotation,
  settings,
  preparedByName,
}: {
  quotation: Quotation;
  settings: Settings;
  preparedByName?: string | null;
}) {
  return <DesignSwitcher quotation={quotation} settings={settings} preparedByName={preparedByName} />;
}
