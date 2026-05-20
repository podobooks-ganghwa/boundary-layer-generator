import type { AppInputs, FlowLevel } from "../types";
import { TOTAL_STEPS } from "../types";

interface Props {
  inputs: AppInputs;
  step: number;
  onStepChange: (step: number) => void;
  onChange: (patch: Partial<AppInputs>) => void;
}

function numField(
  label: string,
  hint: string,
  value: number,
  onChange: (v: number) => void,
  opts?: { min?: number; step?: number }
) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-hint">{hint}</span>
      <input
        type="number"
        value={value}
        min={opts?.min}
        step={opts?.step ?? "any"}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  );
}

function choice<T extends string>(
  title: string,
  hint: string,
  value: T,
  options: { id: T; title: string; desc: string }[],
  onPick: (id: T) => void
) {
  return (
    <div className="choice-group">
      <p className="step-lead">{title}</p>
      <p className="step-hint">{hint}</p>
      <div className="choice-cards">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`choice-card ${value === o.id ? "selected" : ""}`}
            onClick={() => onPick(o.id)}
          >
            <strong>{o.title}</strong>
            <span>{o.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StepWizard({ inputs, step, onStepChange, onChange }: Props) {
  const setFlowLevel = (flowLevel: FlowLevel) => {
    onChange({
      flowLevel,
      inputMode: flowLevel === "freestream" ? "mode_a" : "mode_b",
    });
  };

  const canNext =
    step < TOTAL_STEPS &&
    (step !== 2 ||
      (inputs.bodyType === "2d" && inputs.halfAngleDeg >= 0) ||
      (inputs.bodyType === "axisymmetric" && inputs.halfAngleDeg > 0));

  return (
    <div className="wizard">
      <div className="wizard-header">
        <h2>입력 단계</h2>
        <div className="step-dots">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`dot ${step === i + 1 ? "active" : ""} ${step > i + 1 ? "done" : ""}`}
              onClick={() => onStepChange(i + 1)}
              title={`${i + 1}단계`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="wizard-body">
        {step === 1 &&
          choice(
            "1. 몸체는 2차원인가요, 축대칭인가요?",
            "2D는 평판·웨지, 축대칭은 원뿔(콘) 흐름을 의미합니다.",
            inputs.bodyType,
            [
              {
                id: "2d",
                title: "2D (평판 / 웨지)",
                desc: "평판 또는 날카로운 웨지 위 경계층",
              },
              {
                id: "axisymmetric",
                title: "축대칭 (콘)",
                desc: "원뿔 표면 — Mangler 보정 x_eff = x/3",
              },
            ],
            (bodyType) => onChange({ bodyType })
          )}

        {step === 2 && (
          <div>
            <p className="step-lead">
              2.{" "}
              {inputs.bodyType === "2d"
                ? "2D 기하 각도를 정해 주세요"
                : "콘 반각을 정해 주세요"}
            </p>
            <p className="step-hint">
              {inputs.bodyType === "2d"
                ? "각도 0°이면 평판, 0°보다 크면 웨지로 처리합니다."
                : "원뿔 중심선 기준 반각 [deg]입니다."}
            </p>
            {numField(
              inputs.bodyType === "2d" ? "웨지 각도 [deg]" : "콘 반각 [deg]",
              inputs.bodyType === "2d" ? "0 = 평판" : "예: 7",
              inputs.halfAngleDeg,
              (halfAngleDeg) => onChange({ halfAngleDeg }),
              { min: 0, step: 0.1 }
            )}
          </div>
        )}

        {step === 3 &&
          choice(
            "3. 프리스트림 조건과 엣지 조건 중 무엇을 아시나요?",
            "프리스트림: 총온도·마하 등 원류 정보. 엣지: 경계층 외연 U, p, T.",
            inputs.flowLevel,
            [
              {
                id: "freestream",
                title: "프리스트림 (원류)",
                desc: "마하수, 총온도(또는 총엔탈피), 단위 레이놀즈 수",
              },
              {
                id: "edge",
                title: "엣지 (경계층 외연)",
                desc: "속도 U_e, 압력 p_e, 온도 T_e",
              },
            ],
            setFlowLevel
          )}

        {step === 4 &&
          choice(
            "4. 어떤 형식으로 숫자를 넣을까요?",
            inputs.flowLevel === "freestream"
              ? "프리스트림에는 보통 M, T₀, Re_unit 조합을 씁니다."
              : "엣지에는 보통 U, p, T 조합을 씁니다.",
            inputs.inputMode,
            inputs.flowLevel === "freestream"
              ? [
                  {
                    id: "mode_a",
                    title: "M + T₀ + Re_unit",
                    desc: "마하수, 총온도, 단위 레이놀즈 [1/m]",
                  },
                  {
                    id: "mode_b",
                    title: "U + p + T (엣지 값 직접)",
                    desc: "이미 알고 있는 엣지 속도·압력·온도",
                  },
                ]
              : [
                  {
                    id: "mode_b",
                    title: "U + p + T",
                    desc: "엣지 속도, 압력, 온도 [SI]",
                  },
                  {
                    id: "mode_a",
                    title: "M + T₀ + Re_unit",
                    desc: "마하·총온도·Re로부터 엣지 유도",
                  },
                ],
            (inputMode) => onChange({ inputMode })
          )}

        {step === 5 && (
          <div>
            <p className="step-lead">5. 유동 수치를 입력하세요</p>
            <p className="step-hint">단위는 SI (m, s, K, Pa, kg) 입니다.</p>
            {inputs.inputMode === "mode_a" ? (
              <>
                {numField("마하수 M_e", "엣지 마하", inputs.M_e, (M_e) => onChange({ M_e }), {
                  min: 0.01,
                })}
                <label className="field checkbox-field">
                  <input
                    type="checkbox"
                    checked={inputs.useH0}
                    onChange={(e) => onChange({ useH0: e.target.checked })}
                  />
                  총엔탈피 h₀ 사용 (체크 시 T₀ 대신)
                </label>
                {inputs.useH0
                  ? numField("h₀ [J/kg]", "총엔탈피", inputs.h0, (h0) => onChange({ h0 }))
                  : numField("총온도 T₀ [K]", "프리스트림 총온도", inputs.T0, (T0) =>
                      onChange({ T0 })
                    )}
                {numField(
                  "단위 레이놀즈 Re_unit [1/m]",
                  "ρ_e U_e / μ_e",
                  inputs.Re_unit,
                  (Re_unit) => onChange({ Re_unit })
                )}
              </>
            ) : (
              <>
                {numField("속도 U_e [m/s]", "엣지 속도", inputs.U_e, (U_e) => onChange({ U_e }))}
                {numField("압력 p_e [Pa]", "엣지 정압", inputs.p_e, (p_e) => onChange({ p_e }))}
                {numField("온도 T_e [K]", "엣지 정온", inputs.T_e, (T_e) => onChange({ T_e }), {
                  min: 1,
                })}
              </>
            )}
          </div>
        )}

        {step === 6 && (
          <div>
            <p className="step-lead">6. 벽 온도 T_w</p>
            <p className="step-hint">등온 벽 조건입니다.</p>
            {numField("벽 온도 [K]", "예: 300", inputs.T_w, (T_w) => onChange({ T_w }), { min: 1 })}
          </div>
        )}

        {step === 7 && (
          <div>
            <p className="step-lead">7. 어느 x 위치를 자세히 볼까요?</p>
            <p className="step-hint">스트림 방향 거리 [m]. 아래 그래프에 세로선으로 표시됩니다.</p>
            {numField("선택 x [m]", "프로파일·경계층 그림", inputs.x_sel, (x_sel) =>
              onChange({ x_sel })
            )}
            {numField("x 최소 [m]", "스윕 시작", inputs.x_min, (x_min) => onChange({ x_min }))}
            {numField("x 최대 [m]", "스윕 끝", inputs.x_max, (x_max) => onChange({ x_max }))}
            <label className="field">
              <span className="field-label">경계층 그림 과장 배율</span>
              <span className="field-hint">실제 두께 × 배율 (보기 쉽게)</span>
              <input
                type="range"
                min={1}
                max={40}
                value={inputs.blVisualScale}
                onChange={(e) => onChange({ blVisualScale: parseInt(e.target.value, 10) })}
              />
              <span className="range-val">{inputs.blVisualScale}×</span>
            </label>
          </div>
        )}
      </div>

      <div className="wizard-nav">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={step <= 1}
          onClick={() => onStepChange(step - 1)}
        >
          ← 이전
        </button>
        <span className="step-counter">
          {step} / {TOTAL_STEPS}
        </span>
        <button
          type="button"
          className="btn"
          disabled={!canNext}
          onClick={() => onStepChange(Math.min(TOTAL_STEPS, step + 1))}
        >
          {step >= TOTAL_STEPS ? "완료" : "다음 →"}
        </button>
      </div>
    </div>
  );
}
