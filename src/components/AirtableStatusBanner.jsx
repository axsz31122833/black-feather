import React from "react";

const hasAirtableConfig = Boolean(
  import.meta.env.VITE_AIRTABLE_API_KEY && import.meta.env.VITE_AIRTABLE_BASE_ID
);

function AirtableStatusBanner() {
  if (hasAirtableConfig) return null;
  return (
    <div className="w-full p-2 text-sm text-white bg-yellow-600/40 border-b border-yellow-500/50">
      <div className="container mx-auto flex items-center justify-between">
        <span>Airtable config missing: API Key/Base ID not set, features disabled</span>
      </div>
    </div>
  );
}

export default AirtableStatusBanner;
