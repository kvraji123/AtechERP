import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { apiMessage } from '../../../api/client';
import type { StorageLocation } from '../../../components/GaugeStorageLocation';

export default function InventoryLocations() {
  const [locations,setLocations] = useState<StorageLocation[]>([]);
  const [error,setError] = useState('');
  useEffect(() => { void api.get('/inventory/locations').then((response) => setLocations(response.data.data || [])).catch((reason) => setError(apiMessage(reason))); },[]);
  return <section className="inventory-table-card"><h2>Storage Locations</h2>
    {error ? <p role="alert">{error}</p> : <div className="inventory-table-wrap"><table><thead><tr><th>Warehouse</th><th>Rack / Bin</th><th>Gauges</th></tr></thead><tbody>
      {locations.map((location) => <tr key={location.locationId}><td>{location.warehouseCode}</td><td>{location.binLocation}</td><td><Link to="/masters/gauges">Open Gauge Master</Link></td></tr>)}
    </tbody></table></div>}
  </section>;
}
