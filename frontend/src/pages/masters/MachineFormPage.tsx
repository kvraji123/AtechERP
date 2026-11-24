import DateInput from "../../components/DateInput";
import { useUnsavedChanges } from "../../components/UnsavedChanges";
import { ArrowLeft, Cog, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiMessage } from "../../api/client";
import { locationMasterApi, type LocationMasterRow } from "../../api/locationMaster.api";
import { machineApi } from "../../api/machine.api";
import Alert from "../../components/Alert";
import { useAppFeedback } from "../../components/AppFeedback";
import { useReferenceData } from "../../hooks/useReferenceData";
import "./CustomerFormPage.css";
import "./MachineFormPage.css";

type MachineItem = { itemId:number; itemCode:string; machineName:string; makeName:string; modelName:string;
  machineCapacity:string; machineTypeId:number; machineTypeCode:string; machineTypeName:string;
  hourlyCostInr:number; linkedMachineMasterId?:number|null };
type StatusOption = { value:string; label:string };
type UnitRow = { machineUnitId?:number; machineCode:string; serialNumber:string; installationDate:string;
  plantLocation:string; departmentName:string; unitStatus:string; remarks:string };
const blankUnit = (): UnitRow => ({ machineCode:"",serialNumber:"",installationDate:"",plantLocation:"",
  departmentName:"",unitStatus:"ACTIVE",remarks:"" });

export default function MachineFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const machineMasterId = Number(id || 0);
  const isEdit = machineMasterId > 0;
  const isReadOnly = isEdit && searchParams.get("mode") === "view";
  const { confirmDelete, showSuccess } = useAppFeedback();
  const referenceData = useReferenceData([]);
  const [items,setItems] = useState<MachineItem[]>([]);
  const [locations,setLocations] = useState<LocationMasterRow[]>([]);
  const [unitStatuses,setUnitStatuses] = useState<StatusOption[]>([]);
  const [itemSearch,setItemSearch] = useState("");
  const [itemId,setItemId] = useState("");
  const [otherSpecification,setOtherSpecification] = useState("");
  const [hourlyCostInr,setHourlyCostInr] = useState("");
  const [machineStatus,setMachineStatus] = useState("ACTIVE");
  const [units,setUnits] = useState<UnitRow[]>([blankUnit()]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");

  const unsaved = useUnsavedChanges({itemId,otherSpecification,hourlyCostInr,machineStatus,units}, undefined, !isReadOnly);

  useEffect(() => {
    Promise.all([
      machineApi.lookups(),
      locationMasterApi.list({ status:"Y", pageSize:100 }),
      isEdit ? machineApi.getById(machineMasterId) : Promise.resolve(null),
    ]).then(([lookupResponse,locationResponse,detailResponse]) => {
      const eligibleItems=lookupResponse?.data?.items ?? [];
      setItems(eligibleItems); setLocations(locationResponse?.data ?? []); setUnitStatuses(lookupResponse?.data?.unitStatuses ?? []);
      const data=detailResponse?.data;
      if (!data) return;
      setItemId(String(data.itemId));
      setItemSearch(`${data.itemCode} - ${data.machineName}`);
      setHourlyCostInr(String(data.hourlyCostInr ?? ""));
      setOtherSpecification(data.otherSpecification ?? ""); setMachineStatus(data.machineStatus ?? "ACTIVE");
      setUnits(data.units?.length ? data.units.map((unit:any) => ({ machineUnitId:unit.machineUnitId,
        machineCode:unit.machineCode ?? "",serialNumber:unit.serialNumber ?? "",
        installationDate:unit.installationDate?.slice?.(0,10) ?? "",plantLocation:unit.plantLocation ?? "",
        departmentName:unit.departmentName ?? "",unitStatus:unit.unitStatus ?? "ACTIVE",
        remarks:unit.remarks ?? "" })) : [blankUnit()]);
    }).catch((loadError) => setError(apiMessage(loadError))).finally(() => setLoading(false));
  },[isEdit,machineMasterId]);

  const selectedItem=useMemo(() => items.find((item) => item.itemId === Number(itemId)),[items,itemId]);
  const selectableItems=useMemo(() => items.filter((item) => !item.linkedMachineMasterId || Number(item.linkedMachineMasterId) === machineMasterId),[items,machineMasterId]);
  const selectItem=(value:string) => { setItemSearch(value); const item=items.find((row) => `${row.itemCode} - ${row.machineName}` === value);
    setItemId(item ? String(item.itemId) : ""); setHourlyCostInr(item ? String(item.hourlyCostInr ?? "") : ""); setError(""); };
  const updateUnit=(index:number,field:keyof UnitRow,value:string) => setUnits((rows) => rows.map((row,rowIndex) => rowIndex === index ? {...row,[field]:value}:row));
  const removeUnit=async(index:number) => { if (units.length === 1) return; if (await confirmDelete({title:"Remove machine unit?",message:"This Machine ID row will be removed when you save.",confirmLabel:"Remove Unit"})) setUnits((rows) => rows.filter((_,rowIndex) => rowIndex !== index)); };

  const save=async(event:FormEvent) => {
    const savedSnapshot = unsaved.snapshot();
 event.preventDefault();
    if (isReadOnly) return;
    if (!itemId || !selectedItem) { setError("Select a machine from Item Master."); return; }
    if (!Number.isFinite(Number(hourlyCostInr)) || Number(hourlyCostInr) < 0) { setError("Machine Type hourly cost must be zero or greater."); return; }
    if (units.some((unit) => !unit.machineCode.trim())) { setError("Machine ID is required for every machine unit."); return; }
    const codes=units.map((unit) => unit.machineCode.trim().toUpperCase());
    if (new Set(codes).size !== codes.length) { setError("Duplicate Machine IDs are not allowed."); return; }
    try { setSaving(true); setError(""); const payload={ itemId:Number(itemId),numberOfMachines:units.length,
      hourlyCostInr:Number(hourlyCostInr || 0),
      otherSpecification:otherSpecification.trim() || null,machineStatus,units:units.map((unit) => ({...unit,
        machineCode:unit.machineCode.trim(),machineId:unit.machineCode.trim(),serialNumber:unit.serialNumber.trim() || null,
        installationDate:unit.installationDate || null,plantLocation:unit.plantLocation.trim() || null,
        departmentName:unit.departmentName.trim() || null,
        remarks:unit.remarks.trim() || null}))};
      if (isEdit) await machineApi.update(machineMasterId,payload); else await machineApi.create(payload);
      unsaved.markSaved(savedSnapshot); showSuccess(isEdit ? "Machine Master updated successfully." : "Machine Master created successfully.");
      navigate("/masters/machines");
    } catch(saveError) { setError(apiMessage(saveError)); } finally { setSaving(false); }
  };

  if (loading) return <div className="page-container"><div className="master-table-message">Loading Machine Master...</div></div>;
  return <div className="page-container master-form-page customer-form-compact">
    <section className="master-form-page-header"><div className="master-form-title-group"><Cog size={22}/><h1>{isReadOnly ? "View Machine" : isEdit ? "Edit Machine" : "Create Machine"}</h1></div>
      <div className="master-form-actions"><button type="button" className="customer-cancel-link" onClick={() => navigate("/masters/machines")}><ArrowLeft size={15}/>{isReadOnly ? "Back" : "Cancel"}</button>{isReadOnly ? <button type="button" className="primary-action-button" onClick={() => navigate(`/masters/machines/${machineMasterId}?mode=edit`)}><Pencil size={17}/>Edit Machine</button> : <button type="submit" form="machine-master-form" className="primary-action-button" disabled={saving}><Save size={17}/>{saving ? "Saving..." : isEdit ? "Update Machine" : "Create Machine"}</button>}</div></section>
    {error && <Alert type="error" message={error}/>} 
    <form id="machine-master-form" className="master-entry-form" onSubmit={save}>
      <fieldset className="master-read-only-fields" disabled={isReadOnly}>
      <section className="master-form-section"><div className="master-section-header"><div><h2>Item Master Machine</h2><p>Select a CA / Machines &amp; Equipment item. Model details are fetched automatically.</p></div></div><div className="master-form-grid">
        <label className="master-field span-2"><span>Item Code / Machine Name<b>*</b></span><input list="machine-item-options" value={itemSearch} disabled={isEdit} onChange={(event) => selectItem(event.target.value)} placeholder="Search item code or machine name"/><datalist id="machine-item-options">{selectableItems.map((item) => <option key={item.itemId} value={`${item.itemCode} - ${item.machineName}`}/>)}</datalist></label>
        <label className="master-field"><span>Machine Type</span><input className="readonly" readOnly value={selectedItem ? `${selectedItem.machineTypeCode} - ${selectedItem.machineTypeName}` : ""}/></label>
        <label className="master-field"><span>Machine Type Hourly Cost (INR)<b>*</b></span><input type="number" min="0" step="0.01" value={hourlyCostInr} onChange={(event) => setHourlyCostInr(event.target.value)} placeholder="0.00"/></label>
        <label className="master-field"><span>Status</span><select value={machineStatus} onChange={(event) => setMachineStatus(event.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
        <label className="master-field"><span>Machine Name</span><input className="readonly" readOnly value={selectedItem?.machineName ?? ""}/></label>
        <label className="master-field"><span>Make</span><input className="readonly" readOnly value={selectedItem?.makeName ?? ""}/></label>
        <label className="master-field"><span>Model</span><input className="readonly" readOnly value={selectedItem?.modelName ?? ""}/></label>
        <label className="master-field"><span>No. of Machines</span><input className="readonly machine-count-field" readOnly value={units.length}/></label>
        <label className="master-field span-2"><span>Capacity</span><textarea className="readonly" readOnly value={selectedItem?.machineCapacity ?? ""}/></label>
        <label className="master-field span-2"><span>Other Specification</span><textarea value={otherSpecification} onChange={(event) => setOtherSpecification(event.target.value)} placeholder="Machine Master-specific information not covered in Item Master"/></label>
      </div></section>
      <section className="master-form-section"><div className="master-section-header between"><div><h2>Machine Unit Details</h2><p>Maintain one row for every physical machine. No. of Machines is calculated from these rows.</p></div><button type="button" className="marketing-add-line-button" onClick={() => setUnits((rows) => [...rows,blankUnit()])}><Plus size={16}/>Add Machine Unit</button></div>
        <div className="machine-unit-table-wrapper"><table className="machine-unit-table"><thead><tr><th>#</th><th>Machine ID *</th><th>Serial Number</th><th>Installation Date</th><th>Plant / Location</th><th>Department</th><th>Status</th><th>Remarks</th><th>Action</th></tr></thead><tbody>{units.map((unit,index) => <tr key={unit.machineUnitId ?? `new-${index}`}><td>{index+1}</td><td><input value={unit.machineCode} onChange={(event) => updateUnit(index,"machineCode",event.target.value)} placeholder="VMC-01"/></td><td><input value={unit.serialNumber} onChange={(event) => updateUnit(index,"serialNumber",event.target.value)}/></td><td><DateInput type="date" value={unit.installationDate} onChange={(event) => updateUnit(index,"installationDate",event.target.value)}/></td><td><select value={unit.plantLocation} onChange={(event) => updateUnit(index,"plantLocation",event.target.value)}><option value="">Select location</option>{unit.plantLocation && !locations.some((location) => location.locationName === unit.plantLocation) && <option value={unit.plantLocation}>Existing location: {unit.plantLocation}</option>}{locations.map((location) => <option key={location.locationMasterId} value={location.locationName}>{location.locationName}</option>)}</select></td><td><select value={unit.departmentName} onChange={(event) => updateUnit(index,"departmentName",event.target.value)}><option value="">Select department</option>{unit.departmentName && !referenceData.departments.some((department) => department.departmentName === unit.departmentName) && <option value={unit.departmentName}>Existing: {unit.departmentName}</option>}{referenceData.departments.map((department) => <option key={department.departmentCode} value={department.departmentName}>{department.departmentName}</option>)}</select></td><td><select value={unit.unitStatus} onChange={(event) => updateUnit(index,"unitStatus",event.target.value)}>{unitStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td><td><input value={unit.remarks} onChange={(event) => updateUnit(index,"remarks",event.target.value)}/></td><td><button type="button" className="marketing-delete-line-button" disabled={units.length===1} onClick={() => void removeUnit(index)}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>
      </section>
      </fieldset>
    </form>
  </div>;
}
