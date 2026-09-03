const STYLES = {
  waiting: { label: "Waiting", cls: "badge-pending" },
  "in-consultation": { label: "In Consultation", cls: "badge-accepted" },
  "awaiting-payment": { label: "Awaiting Payment", cls: "badge-pending" },
  completed: { label: "Completed", cls: "badge-completed" },
  cancelled: { label: "Cancelled", cls: "badge-rejected" },
  pending: { label: "Pending", cls: "badge-pending" },
  "awaiting-verification": { label: "Awaiting Verification", cls: "badge-accepted" },
  verified: { label: "Verified", cls: "badge-completed" },
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || { label: status, cls: "badge-pending" };
  return <span className={style.cls}>{style.label}</span>;
}
