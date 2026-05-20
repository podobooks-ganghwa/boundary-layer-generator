import { useMemo, useState } from "react";
import CsvExport from "./components/CsvExport";
import GeometryEnvelope from "./components/GeometryEnvelope";
import ProfilePlots from "./components/ProfilePlots";
import StepWizard from "./components/StepWizard";
import SummaryTable from "./components/SummaryTable";
import SweepPlots from "./components/SweepPlots";
import { MODEL_LABEL } from "./physics/constants";
import { solveBlasius } from "./physics/blasius";
import {
  fromFreestreamWithShock,
  fromModeA,
  fromModeB,
  type EdgeFromFreestreamResult,
} from "./physics/edgeConditions";
import { MANGLER_NOTE, type GeometryConfig } from "./physics/geometry";
import { linspace, profileAtX, xSweep } from "./physics/profiles";
import { DEFAULT_INPUTS, deriveGeometry, TOTAL_STEPS, type AppInputs } from "./types";
import { APP_VERSION } from "./version";

type BuildResult = {
  edge: ReturnType<typeof fromModeB>;
  freestreamMeta: EdgeFromFreestreamResult | null;
};

function buildEdge(inputs: AppInputs): BuildResult {
  const geom = deriveGeometry(inputs);
  const deflectionDeg =
    geom.kind === "flat_plate" ? 0 : inputs.halfAngleDeg;

  if (inputs.flowLevel === "freestream") {
    const meta = fromFreestreamWithShock({
      inputMode: inputs.inputMode,
      T_w: inputs.T_w,
      deflectionDeg,
      coneModel:
        geom.kind === "cone" ? inputs.coneFreestreamModel : "oblique_2d",
      ...(inputs.inputMode === "mode_a"
        ? {
            M_inf: inputs.M_inf,
            Re_unit: inputs.Re_unit,
            ...(inputs.useH0 ? { h0: inputs.h0 } : { T0: inputs.T0 }),
          }
        : {
            U_inf: inputs.U_inf,
            p_inf: inputs.p_inf,
            T_inf: inputs.T_inf,
          }),
    });
    return { edge: meta.edge, freestreamMeta: meta };
  }

  if (inputs.inputMode === "mode_a") {
    return {
      edge: fromModeA({
        M_e: inputs.M_e,
        T_w: inputs.T_w,
        Re_unit: inputs.Re_unit,
        ...(inputs.useH0 ? { h0: inputs.h0 } : { T0: inputs.T0 }),
      }),
      freestreamMeta: null,
    };
  }
  return {
    edge: fromModeB({
      U_e: inputs.U_e,
      p_e: inputs.p_e,
      T_e: inputs.T_e,
      T_w: inputs.T_w,
    }),
    freestreamMeta: null,
  };
}

export default function App() {
  const [inputs, setInputs] = useState<AppInputs>(DEFAULT_INPUTS);
  const [step, setStep] = useState(1);

  const result = useMemo(() => {
    try {
      const { edge, freestreamMeta } = buildEdge(inputs);
      const geom = deriveGeometry(inputs);
      const geometry: GeometryConfig = {
        kind: geom.kind,
        coneHalfAngleDeg: geom.coneHalfAngleDeg,
      };
      const blasius = solveBlasius(inputs.eta_max, inputs.n_eta);
      const xArr = linspace(inputs.x_min, inputs.x_max, inputs.n_x);
      const prof = profileAtX(edge, geometry, inputs.x_sel, blasius);
      const sweep = xSweep(edge, geometry, xArr, blasius);
      return {
        edge,
        geometry,
        prof,
        sweep,
        freestreamMeta,
        error: null as string | null,
      };
    } catch (e) {
      return {
        edge: null,
        geometry: null,
        prof: null,
        sweep: null,
        freestreamMeta: null,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }, [inputs]);

  const patch = (p: Partial<AppInputs>) => setInputs((prev) => ({ ...prev, ...p }));

  return (
    <div className="app">
      <header>
        <h1>
          Boundary Layer Generator
          <span className="app-version">{APP_VERSION}</span>
        </h1>
        <p className="subtitle">
          브라우저에서 돌아가는 경계층 유사해 프로파일 생성기 (평판 · 웨지 · 콘)
        </p>
      </header>
      <p className="notice info">모든 계산은 이 컴퓨터 브라우저 안에서만 실행됩니다.</p>

      <StepWizard
        inputs={inputs}
        step={step}
        onStepChange={setStep}
        onChange={patch}
      />

      {step >= TOTAL_STEPS && (
        <p className="notice warn subtle">{MODEL_LABEL}</p>
      )}

      {result.error ? (
        <p className="error">{result.error}</p>
      ) : (
        step >= TOTAL_STEPS &&
        result.edge &&
        result.prof &&
        result.sweep &&
        result.geometry && (
          <main className="main results">
            <section>
              <h2>계산 결과 요약</h2>
              <SummaryTable
                edge={result.edge}
                resolved={result.freestreamMeta?.resolved}
                shock={result.freestreamMeta?.shock}
                taylorMaccoll={result.freestreamMeta?.taylorMaccoll}
                shockNote={result.freestreamMeta?.shock?.note}
                tmNote={result.freestreamMeta?.taylorMaccoll?.note}
              />
              <div className="metrics">
                <div className="metric">
                  <div className="label">δ₉₉ @ x</div>
                  <div className="value">{(result.prof.delta_99 * 1e3).toFixed(3)} mm</div>
                </div>
                <div className="metric">
                  <div className="label">Re_x</div>
                  <div className="value">{result.prof.Re_x.toExponential(3)}</div>
                </div>
                <div className="metric">
                  <div className="label">C_f (근사)</div>
                  <div className="value">{result.prof.Cf.toExponential(4)}</div>
                </div>
              </div>
              {result.geometry.kind === "cone" && (
                <p className="notice warn">{MANGLER_NOTE}</p>
              )}
            </section>

            <section className="hero-plot">
              <h2>몸체 + 경계층 (과장 표시)</h2>
              <p className="section-hint">
                빨간 영역: x = {inputs.x_sel} m 프로파일. 파란 점선: δ₉₉ × {inputs.blVisualScale}×
              </p>
              <GeometryEnvelope
                sweep={result.sweep}
                prof={result.prof}
                geometry={result.geometry}
                xSel={inputs.x_sel}
                visualScale={inputs.blVisualScale}
                shockBetaDeg={result.freestreamMeta?.taylorMaccoll?.beta_deg}
              />
            </section>

            <section>
              <h2>프로파일 (x = {inputs.x_sel} m)</h2>
              <ProfilePlots
                prof={result.prof}
                geometry={result.geometry}
                yLogScale={inputs.yLogScale}
              />
            </section>

            <section>
              <h2>스트림 방향 변화</h2>
              <SweepPlots
                sweep={result.sweep}
                geometry={result.geometry}
                xSel={inputs.x_sel}
              />
            </section>

            <section>
              <h2>CSV 저장</h2>
              <CsvExport prof={result.prof} sweep={result.sweep} />
            </section>
          </main>
        )
      )}

      {step < TOTAL_STEPS && !result.error && (
        <p className="hint-bottom">6단계까지 입력하면 아래에 그래프가 나타납니다.</p>
      )}
    </div>
  );
}
