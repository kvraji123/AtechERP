import { Plus, Trash2 } from "lucide-react";

export type ItemInspectionCharacteristicRow = {
  itemInspectionCharacteristicId?: number;
  characteristicMasterId: string;
  characteristicText: string;
  characteristicSearch: string;
  specifiedDimension: string;
  toleranceGradeId: string;
  toleranceGradeText: string;
  toleranceMinus: string;
  tolerancePlus: string;
  lsl: string;
  usl: string;
  drawingGrid: string;
  instrumentMasterId: string;
  sampleSize: string;
  inspectionFrequency: string;
};

export type ItemInspectionMasters = {
  characteristics: Array<{ characteristicMasterId: number; characteristicCode: string; characteristicName: string }>;
  instruments: Array<{ instrumentMasterId: number; instrumentCode: string; instrumentName: string }>;
  toleranceGrades: Array<{ toleranceGradeId: number; gradeCode: string; basicSizeFrom: number; basicSizeTo: number; lowerDeviationMicrons: number; upperDeviationMicrons: number }>;
  sampleSizes: Array<{ value: string; label: string }>;
  frequencies: Array<{ value: string; label: string }>;
};

export const blankItemInspectionCharacteristic = (): ItemInspectionCharacteristicRow => ({
  characteristicMasterId: "", characteristicText: "", characteristicSearch: "", specifiedDimension: "",
  toleranceGradeId: "", toleranceGradeText: "", toleranceMinus: "", tolerancePlus: "", lsl: "", usl: "",
  drawingGrid: "", instrumentMasterId: "", sampleSize: "", inspectionFrequency: "",
});

const numberOrNull = (value: string) => value.trim() === "" || !Number.isFinite(Number(value)) ? null : Number(value);

export default function ItemIncomingInspectionPlan({ rows, masters, onChange }: {
  rows: ItemInspectionCharacteristicRow[];
  masters: ItemInspectionMasters;
  onChange: (rows: ItemInspectionCharacteristicRow[]) => void;
}) {
  const matchingGrade = (row: ItemInspectionCharacteristicRow) => {
    const gradeText = row.toleranceGradeText.trim().toUpperCase();
    const dimension = numberOrNull(row.specifiedDimension);
    if (!gradeText || dimension === null) return undefined;
    return masters.toleranceGrades.find((entry) => entry.gradeCode.trim().toUpperCase() === gradeText
      && (Number(entry.basicSizeFrom) === 0 ? dimension >= 0 : dimension > Number(entry.basicSizeFrom))
      && dimension <= Number(entry.basicSizeTo));
  };

  const update = (index: number, field: keyof ItemInspectionCharacteristicRow, value: string) => {
    const next = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row);
    let current = next[index];
    if (["specifiedDimension", "toleranceGradeText", "toleranceMinus", "tolerancePlus"].includes(field)) {
      const dimension = numberOrNull(current.specifiedDimension);
      const grade = matchingGrade(current);
      if (grade && dimension !== null) {
        current = {
          ...current, toleranceGradeId: String(grade.toleranceGradeId),
          toleranceMinus: String(Math.abs(Number(grade.lowerDeviationMicrons)) / 1000),
          tolerancePlus: String(Number(grade.upperDeviationMicrons) / 1000),
          lsl: (dimension + Number(grade.lowerDeviationMicrons) / 1000).toFixed(4),
          usl: (dimension + Number(grade.upperDeviationMicrons) / 1000).toFixed(4),
        };
      } else {
        const toleranceMinus = numberOrNull(current.toleranceMinus);
        const tolerancePlus = numberOrNull(current.tolerancePlus);
        current = {
          ...current, toleranceGradeId: "",
          lsl: dimension !== null && toleranceMinus !== null ? (dimension - toleranceMinus).toFixed(4) : "",
          usl: dimension !== null && tolerancePlus !== null ? (dimension + tolerancePlus).toFixed(4) : "",
        };
      }
      next[index] = current;
    }
    onChange(next);
  };

  const chooseCharacteristic = (index: number, searchText: string) => {
    const normalized = searchText.trim().toUpperCase();
    const match = masters.characteristics.find((entry) => entry.characteristicName.trim().toUpperCase() === normalized
      || entry.characteristicCode.trim().toUpperCase() === normalized);
    onChange(rows.map((row, rowIndex) => rowIndex === index ? {
      ...row,
      characteristicSearch: searchText,
      characteristicMasterId: match ? String(match.characteristicMasterId) : "",
      characteristicText: match ? "" : searchText.trim(),
    } : row));
  };

  return <section className="master-form-section item-incoming-inspection-section">
    <div className="master-section-header between"><div><h2>Incoming Inspection Plan</h2><p>Inspection characteristics will be used for this item during GRN inward inspection.</p></div>
      <button type="button" className="marketing-add-line-button" onClick={() => onChange([...rows, blankItemInspectionCharacteristic()])}><Plus size={16}/>Add Characteristic</button>
    </div>
    <datalist id="item-inspection-characteristic-options">{masters.characteristics.map((entry) => <option key={entry.characteristicMasterId} value={entry.characteristicName}>{entry.characteristicCode}</option>)}</datalist>
    <datalist id="item-inspection-tolerance-grade-options">{[...new Set(masters.toleranceGrades.map((entry) => entry.gradeCode))].map((gradeCode) => <option key={gradeCode} value={gradeCode}/>)}</datalist>
    <div className="item-inspection-table-wrap"><table className="item-inspection-table"><thead><tr><th>#</th><th>Characteristic</th><th>Specified Dimension</th><th>Tolerance Grade</th><th>Tol−</th><th>Tol+</th><th>LSL</th><th>USL</th><th>Drawing Grid</th><th>Instrument / Gauge</th><th>Sample Size</th><th>Inspection Frequency</th><th/></tr></thead>
      <tbody>{rows.map((row, index) => { const grade = matchingGrade(row); return <tr key={row.itemInspectionCharacteristicId ?? `item-inspection-${index}`}>
        <td className="item-inspection-row-number">{index + 1}</td>
        <td><div className="item-inspection-search"><input list="item-inspection-characteristic-options" value={row.characteristicSearch} onChange={(event) => chooseCharacteristic(index, event.target.value)} placeholder="Search or enter characteristic"/><small className={row.characteristicMasterId ? "matched" : row.characteristicText ? "manual" : ""}>{row.characteristicMasterId ? "Master matched" : row.characteristicText ? "Free text characteristic" : "Search or type a characteristic"}</small></div></td>
        <td><input type="number" min="0" step="0.0001" value={row.specifiedDimension} onChange={(event) => update(index, "specifiedDimension", event.target.value)}/></td>
        <td><div className="item-inspection-grade"><input list="item-inspection-tolerance-grade-options" value={row.toleranceGradeText} onChange={(event) => update(index, "toleranceGradeText", event.target.value)} placeholder="Type grade"/><small className={grade ? "matched" : "manual"}>{grade ? "Master matched" : "Manual tolerance"}</small></div></td>
        <td><input type="number" min="0" step="0.0001" readOnly={Boolean(grade)} value={row.toleranceMinus} onChange={(event) => update(index, "toleranceMinus", event.target.value)}/></td>
        <td><input type="number" min="0" step="0.0001" readOnly={Boolean(grade)} value={row.tolerancePlus} onChange={(event) => update(index, "tolerancePlus", event.target.value)}/></td>
        <td><input readOnly value={row.lsl}/></td><td><input readOnly value={row.usl}/></td>
        <td><input value={row.drawingGrid} onChange={(event) => update(index, "drawingGrid", event.target.value)}/></td>
        <td><select value={row.instrumentMasterId} onChange={(event) => update(index, "instrumentMasterId", event.target.value)}><option value="">Select</option>{masters.instruments.map((entry) => <option key={entry.instrumentMasterId} value={entry.instrumentMasterId}>{entry.instrumentName}</option>)}</select></td>
        <td><select value={row.sampleSize} onChange={(event) => update(index, "sampleSize", event.target.value)}><option value="">Select</option>{masters.sampleSizes.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></td>
        <td><select value={row.inspectionFrequency} onChange={(event) => update(index, "inspectionFrequency", event.target.value)}><option value="">Select</option>{masters.frequencies.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></td>
        <td><button type="button" className="marketing-delete-line-button" aria-label={`Remove characteristic ${index + 1}`} onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={15}/></button></td>
      </tr>; })}</tbody>
    </table></div>
    {!rows.length && <p className="item-inspection-empty">Add at least one characteristic for an item that requires incoming inspection.</p>}
  </section>;
}
