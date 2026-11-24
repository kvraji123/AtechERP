export type StorageLocation = { locationId: number; warehouseCode: string; binLocation: string; label: string };

export default function GaugeStorageLocation({ locations, value, onChange, disabled = false }: {
  locations: StorageLocation[]; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  return <label className="master-field"><span>Storage Warehouse / Rack</span>
    <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      <option value="">Select storage location</option>
      {value && !locations.some((entry) => String(entry.locationId) === value) && <option value={value}>Existing inactive location</option>}
      {locations.map((entry) => <option key={entry.locationId} value={entry.locationId}>{entry.label}</option>)}
    </select><small>Home storage location set during gauge registration. It is controlled separately from the gauge’s current location.</small>
  </label>;
}
