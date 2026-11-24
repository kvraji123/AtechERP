import "./CompanyMark.css";
import companyLogo from "../assets/atech-logo.jpeg";

type CompanyMarkProps = {
  className?: string;
};

export default function CompanyMark({ className = "" }: CompanyMarkProps) {
  return (
    <img
      className={`company-mark ${className}`.trim()}
      src={companyLogo}
      alt="A Tech Automation"
    />
  );
}
