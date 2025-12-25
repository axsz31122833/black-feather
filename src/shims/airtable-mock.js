// Vite alias shim for 'airtable' to avoid runtime crash when API key/Base ID are missing.
// Provides minimal no-op implementations so the UI can render without secrets.

const hasKey = !!(import.meta.env && import.meta.env.VITE_AIRTABLE_API_KEY && import.meta.env.VITE_AIRTABLE_BASE_ID);

class AirtableMock {
  constructor(opts = {}) {
    if (!hasKey) {
      console.warn('[AirtableMock] API key/base id missing. Running in mock mode. Features requiring Airtable will be disabled.');
    }
  }
  base(baseId) {
    return function(tableName) {
      const api = {
        select(options = {}) {
          return {
            all: async () => {
              console.warn(`[AirtableMock] select.all() called for table "${tableName}" (mock returns empty array)`);
              return [];
            },
          };
        },
        create(records = []) {
          console.warn(`[AirtableMock] create() called for table "${tableName}" (mock returns echo)`);
          const fields = (records[0] && records[0].fields) || {};
          return Promise.resolve([{ id: 'mock-id', fields }]);
        },
        update(updates = []) {
          console.warn(`[AirtableMock] update() called for table "${tableName}" (mock resolves)`);
          return Promise.resolve();
        },
        find(id) {
          console.warn(`[AirtableMock] find(${id}) called for table "${tableName}" (mock returns empty record)`);
          return Promise.resolve({ id: 'mock-id', fields: {} });
        },
      };
      return api;
    };
  }
}

export default AirtableMock;