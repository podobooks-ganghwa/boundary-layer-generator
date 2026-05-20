import type { EdgeConditions } from "../physics/edgeConditions";
import { edgeToRows, freestreamShockToRows } from "../physics/edgeConditions";
import type { FreestreamState, PostShockState } from "../physics/shockRelations";

interface Props {
  edge: EdgeConditions;
  freestream?: FreestreamState;
  shock?: PostShockState;
}

function Table({ title, rows }: { title: string; rows: { quantity: string; value: string }[] }) {
  return (
    <>
      <h3 className="table-subtitle">{title}</h3>
      <table className="summary">
        <tbody>
          {rows.map((r) => (
            <tr key={r.quantity}>
              <th>{r.quantity}</th>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function SummaryTable({ edge, freestream, shock }: Props) {
  return (
    <div className="summary-wrap">
      {freestream && shock && (
        <>
          <Table title="프리스트림 & 충격파 → 엣지 (자동 계산)" rows={freestreamShockToRows(freestream, shock)} />
          <p className="shock-note">{shock.note}</p>
        </>
      )}
      <Table
        title={freestream ? "경계층 엣지 조건 (충격 후, BL 계산에 사용)" : "엣지 조건"}
        rows={edgeToRows(edge)}
      />
    </div>
  );
}
