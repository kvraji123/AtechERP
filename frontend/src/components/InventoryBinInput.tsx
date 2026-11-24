import type { LocationMasterRow } from '../api/locationMaster.api';

export default function InventoryBinInput({ warehouse, subinventoryCode, locations, value, disabled, onChange }: {
  warehouse: string; subinventoryCode?: string; locations: LocationMasterRow[]; value: string; disabled?: boolean; onChange: (value: string) => void;
}) {
  const availableLocations = locations.filter((location) => location.warehouseName === warehouse
    && (!subinventoryCode || location.subinventoryCode === subinventoryCode));
  const hasSelectedLocation = availableLocations.some((location) => location.locationName === value);
  return <select aria-label="Bin Location" disabled={disabled || !warehouse || !subinventoryCode || !availableLocations.length} value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">{!warehouse ? 'Select warehouse first' : !subinventoryCode ? 'Select sub-inventory first' : 'Select bin location'}</option>
    {value && !hasSelectedLocation && <option value={value}>Existing location: {value}</option>}
    {availableLocations.map((location) => <option key={location.locationMasterId} value={location.locationName}>{location.locationName}</option>)}
  </select>;
}
