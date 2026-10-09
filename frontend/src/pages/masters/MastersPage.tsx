import {
  ArrowRight,
  Boxes,
  Building2,
  CirclePlus,
  CircleX,
  Cog,
  Gauge,
  PackageSearch,
  PackagePlus,
  Ruler,
  Settings2,
  Workflow,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import "./MastersPage.css";
type MasterCardProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  onCreate: () => void;
  onManage: () => void;
};

function MasterCard({
  title,
  description,
  icon,
  onCreate,
  onManage,
}: MasterCardProps) {
  return (
    <article className="master-menu-card">
      <div className="master-menu-card-icon">
        {icon}
      </div>

      <div className="master-menu-card-content">
        <h2>{title}</h2>

        <p>{description}</p>
      </div>

      <div className="master-menu-card-actions">
        <button
          type="button"
          className="master-secondary-button"
          onClick={onCreate}
        >
          <CirclePlus size={17} />
          Create New
        </button>

        <button
          type="button"
          className="master-primary-button"
          onClick={onManage}
        >
          Manage
          <ArrowRight size={17} />
        </button>
      </div>
    </article>
  );
}

export default function MastersPage() {
  const navigate = useNavigate();

  return (
    <div className="page-container masters-page">
      <section className="masters-page-header">
        <div>
          <p className="page-eyebrow">
            MARKETING / MASTER MANAGEMENT
          </p>

          <h1>Masters</h1>

          <p>
            Create and maintain customer, part, item and machine
            master information.
          </p>
        </div>

        <div className="masters-header-icon">
          <Boxes size={28} />
        </div>
      </section>

      <section className="masters-info-card">
        <div className="masters-info-icon">
          <Boxes size={22} />
        </div>

        <div>
          <strong>Master Data Management</strong>

          <span>
            Select a master below to create, view and
            maintain records.
          </span>
        </div>
      </section>

      <section className="masters-card-grid">
        <MasterCard
          title="Customer Master"
          description="Maintain customer details, addresses, statutory details, contacts, bank information and attachments."
          icon={<Building2 size={31} />}
          onCreate={() => navigate("/masters/customers/new")}
          onManage={() => navigate("/masters/customers")}
        />
        <MasterCard
          title="Supplier Master"
          description="Maintain supplier details, addresses, statutory details, contacts, bank information and attachments."
          icon={<Building2 size={31} />}
          onCreate={() =>
            navigate("/masters/suppliers/new")
          }
          onManage={() =>
            navigate("/masters/suppliers")
          }
        />

        <MasterCard
          title="Part Master"
          description="Maintain customer-linked parts, drawing information, revisions, material specifications, project details and technical attachments."
          icon={<PackageSearch size={31} />}
          onCreate={() =>
            navigate("/masters/parts/new")
          }
          onManage={() =>
            navigate("/masters/parts")
          }
        />

        <MasterCard
          title="Item Master"
          description="Maintain inventory items, groups, types, materials, UOMs, suppliers, stock controls and attachments."
          icon={<PackagePlus size={31} />}
          onCreate={() => navigate("/masters/items/new")}
          onManage={() => navigate("/masters/items")}
        />

        <MasterCard
          title="Machine Master"
          description="Link Capital Item machine models and maintain individual Machine IDs, serial numbers, installation details, locations and status."
          icon={<Cog size={31} />}
          onCreate={() => navigate("/masters/machines/new")}
          onManage={() => navigate("/masters/machines")}
        />
        <MasterCard title="Operation Name Master"
          description="Maintain operation names, display order and default in-house or outsource source."
          icon={<Settings2 size={31}/>} onCreate={() => navigate("/masters/operations")}
          onManage={() => navigate("/masters/operations")}/>
        <MasterCard title="Tolerance Grade Master"
          description="Maintain basic-size ranges and upper/lower deviations used to calculate LSL and USL."
          icon={<Ruler size={31}/>} onCreate={() => navigate("/masters/tolerance-grades")}
          onManage={() => navigate("/masters/tolerance-grades")}/>
        <MasterCard title="Instrument Master"
          description="Maintain inspection instruments and gauges available in Inspection Plans."
          icon={<Gauge size={31}/>} onCreate={() => navigate("/masters/instruments")}
          onManage={() => navigate("/masters/instruments")}/>
        <MasterCard title="Rejection Reason Master"
          description="Maintain standard quality rejection reasons, applicable receipt types and required supporting details."
          icon={<CircleX size={31}/>} onCreate={() => navigate("/masters/rejection-reasons")}
          onManage={() => navigate("/masters/rejection-reasons")}/>
        <MasterCard title="Rejection Disposition Master"
          description="Maintain the follow-up actions for rejected material, including return, hold, rework and scrap."
          icon={<Workflow size={31}/>} onCreate={() => navigate("/masters/rejection-dispositions")}
          onManage={() => navigate("/masters/rejection-dispositions")}/>
      </section>
    </div>
  );
}
