import { useEffect, useId, useState } from 'react';
import { api, apiMessage } from '../api/client';
import type { StorageLocation } from './GaugeStorageLocation';

export default function InventoryBinInput({ warehouse, value, disabled, onChange }: {
  warehouse: string; value: string; disabled?: boolean; onChange: (value: string) => void;
}) {
  const id = useId();
  const [locations,setLocations] = useState<StorageLocation[]>([]);
  const [error,setError] = useState('');
  useEffect(() => { void api.get('/inventory/locations').then((response) => setLocations(response.data.data || [])).catch((reason) => setError(apiMessage(reason))); },[]);
  return <><input list={id} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Select or enter rack / bin"/>
    <datalist id={id}>{locations.filter((entry) => entry.warehouseCode === warehouse).map((entry) => <option key={entry.locationId} value={entry.binLocation}/>)}</datalist>
    {error && <small role="alert">Location suggestions unavailable: {error}</small>}</>;
}
