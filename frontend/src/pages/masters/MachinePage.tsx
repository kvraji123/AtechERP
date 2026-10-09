import { Cog, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiMessage } from "../../api/client";
import { machineApi } from "../../api/machine.api";
import Alert from "../../components/Alert";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import { useAppFeedback } from "../../components/AppFeedback";
import "./CustomerPage.css";
import "./MachinePage.css";

type MachineRow = {
  machineMasterId: number; itemCode: string; machineName: string; machineTypeCode: string;
  machineTypeName: string; makeName: string; modelName: string; machineCapacity: string;
  hourlyCostInr:number; numberOfMachines: number; machineCodes?: string; machineStatus: "ACTIVE" | "INACTIVE";
};

export default function MachinePage() {
  const navigate = useNavigate();
  const { confirmDelete, showSuccess } = useAppFeedback();
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    machineApi.list({ page, pageSize: PAGE_SIZE, search, status: status as "ACTIVE" | "INACTIVE" | "" }).then((response) => { setMachines(response?.data ?? []); setTotal(Number(response?.meta?.total || 0)); })
      .catch((loadError) => setError(apiMessage(loadError))).finally(() => setLoading(false));
  };
  useEffect(load, [page, search, status]);

  const remove = async (machine: MachineRow) => {
    const confirmed = await confirmDelete({ title: "Delete Machine Master?",
      message: `${machine.machineName} and all ${machine.numberOfMachines} machine unit record(s) will be permanently deleted.`,
      confirmLabel: "Delete Machine" });
    if (!confirmed) return;
    try { await machineApi.remove(machine.machineMasterId); showSuccess("Machine Master deleted successfully."); load(); }
    catch (deleteError) { setError(apiMessage(deleteError)); }
  };

  return <div className="page-container master-list-page">
    <section className="master-list-header"><div><p className="page-eyebrow">MASTERS / MACHINE MASTER</p>
      <h1>Machine Master</h1><span>Maintain Item Master-linked machine models and installed machine units.</span></div>
      <button type="button" className="primary-action-button" onClick={() => navigate("/masters/machines/new")}><Plus size={17}/>New Machine</button>
    </section>
    <section className="master-list-card">
      {error && <Alert type="error" message={error}/>} 
      <div className="machine-filter-grid app-list-toolbar"><div className="master-search-box"><Search size={18}/><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search item, machine, make, model or Machine ID"/></div>
        <select className="master-filter-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All Status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
        <Pagination page={page} total={total} onPageChange={setPage} itemLabel="machines" disabled={loading} />
      </div>
      <div className="master-table-wrapper"><table className="master-data-table machine-master-table"><thead><tr><th>Item Code</th><th>Machine Name</th><th>Machine Type</th><th>Hourly Cost (INR)</th><th>Make</th><th>Model</th><th>Capacity</th><th>No. of Machines</th><th>Machine IDs</th><th>Status</th><th className="master-actions-column">Actions</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={11}><div className="master-table-message">Loading machines...</div></td></tr> : machines.length === 0 ? <tr><td colSpan={11}><div className="master-empty-state"><div className="master-empty-icon"><Cog size={30}/></div><h3>No machines found</h3><p>Create a Machine Master record from an eligible Item Master machine.</p><button type="button" className="primary-action-button" onClick={() => navigate("/masters/machines/new")}><Plus size={17}/>Create Machine</button></div></td></tr> : machines.map((machine) => <tr key={machine.machineMasterId}><td><strong>{machine.itemCode}</strong></td><td>{machine.machineName}</td><td>{machine.machineTypeCode}</td><td>{Number(machine.hourlyCostInr || 0).toFixed(2)}</td><td>{machine.makeName}</td><td>{machine.modelName}</td><td className="machine-capacity-cell">{machine.machineCapacity}</td><td><span className="machine-count-badge">{machine.numberOfMachines}</span></td><td>{machine.machineCodes || "-"}</td><td><span className={`master-status-badge ${machine.machineStatus === "ACTIVE" ? "active" : "inactive"}`}>{machine.machineStatus}</span></td><td><div className="master-row-actions"><button title="View machine" onClick={() => navigate(`/masters/machines/${machine.machineMasterId}`)}><Eye size={16}/></button><button title="Edit machine" onClick={() => navigate(`/masters/machines/${machine.machineMasterId}`)}><Pencil size={16}/></button><button title="Delete machine" onClick={() => void remove(machine)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>
      
    </section>
  </div>;
}
