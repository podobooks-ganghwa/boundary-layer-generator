import type { AppInputs, FlowLevel, InputMode } from "../types";
import { deriveGeometry } from "../types";
import { TOTAL_STEPS } from "../types";

/** UI 단위 ↔ 내부 SI (Re: 1/m, h: J/kg) */
const RE_PER_M_TO_E6 = 1e6;
const H_JKG_TO_MJKG = 1e6;

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
  opts?: { min?: number; max?: number; step?: number }
) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-hint">{hint}</span>
      <input
        type="number"
        value={value}
        min={opts?.min}
        max={opts?.max}
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

function ValueFields({
  inputs,
  onChange,
}: {
  inputs: AppInputs;
  onChange: (patch: Partial<AppInputs>) => void;
}) {
  const fs = inputs.flowLevel === "freestream";

  if (inputs.inputMode === "mode_a") {
    return (
      <>
        {numField(
          fs ? "M∞" : "M_e",
          "마하수",
          fs ? inputs.M_inf : inputs.M_e,
          (v) => onChange(fs ? { M_inf: v } : { M_e: v }),
          { min: fs ? 1.01 : 0.01 }
        )}
        {numField(
          "Re [×10⁶/m]",
          "단위 레이놀즈 수 (e6/m)",
          inputs.Re_unit / RE_PER_M_TO_E6,
          (reE6) => onChange({ Re_unit: reE6 * RE_PER_M_TO_E6 })
        )}
        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={!inputs.useH0}
            onChange={(e) => onChange({ useH0: !e.target.checked })}
          />
          T₀ [K] 사용 (체크 해제 시 h_tot)
        </label>
        {inputs.useH0 ? (
          numField(
            "h_tot [MJ/kg]",
            "총엔탈피",
            inputs.h0 / H_JKG_TO_MJKG,
            (hMj) => onChange({ h0: hMj * H_JKG_TO_MJKG })
          )
        ) : (
          numField("T₀ [K]", "총온도", inputs.T0, (T0) => onChange({ T0 }))
        )}
      </>
    );
  }

  return (
    <>
      {numField(
        fs ? "U∞ [m/s]" : "U_e [m/s]",
        "속도",
        fs ? inputs.U_inf : inputs.U_e,
        (v) => onChange(fs ? { U_inf: v } : { U_e: v })
      )}
      {numField(
        fs ? "p∞ [Pa]" : "p_e [Pa]",
        "압력",
        fs ? inputs.p_inf : inputs.p_e,
        (v) => onChange(fs ? { p_inf: v } : { p_e: v })
      )}
      {numField(
        fs ? "T∞ [K]" : "T_e [K]",
        "온도",
        fs ? inputs.T_inf : inputs.T_e,
        (v) => onChange(fs ? { T_inf: v } : { T_e: v }),
        { min: 1 }
      )}
    </>
  );
}

export default function StepWizard({ inputs, step, onStepChange, onChange }: Props) {
  const setFlowLevel = (flowLevel: FlowLevel) => onChange({ flowLevel });

  const setInputMode = (inputMode: InputMode) => onChange({ inputMode });

  const canNext =
    step < TOTAL_STEPS &&
    (step !== 1 ||
      (inputs.bodyType === "2d" && inputs.halfAngleDeg >= 0) ||
      (inputs.bodyType === "axisymmetric" && inputs.halfAngleDeg > 0));

  const stateName = inputs.flowLevel === "freestream" ? "프리스트림" : "엣지";

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
        {/* 1. 기하 */}
        {step === 1 && (
          <div>
            {choice(
              "1. 기하",
              "평판(0°): 프리스트림=엣지 · 웨지: 2D oblique · 콘: Taylor–Maccoll",
              inputs.bodyType,
              [
                { id: "2d", title: "2D (평판 / 웨지)", desc: "평판 또는 웨지" },
                { id: "axisymmetric", title: "축대칭 (콘)", desc: "Mangler x_eff = x/3" },
              ],
              (bodyType) => onChange({ bodyType })
            )}
            {numField(
              inputs.bodyType === "2d" ? "웨지 각도 [deg]" : "콘 반각 [deg]",
              inputs.bodyType === "2d" ? "0° = 평판" : "예: 7",
              inputs.halfAngleDeg,
              (halfAngleDeg) => onChange({ halfAngleDeg }),
              { min: 0, step: 0.1 }
            )}
          </div>
        )}

        {/* 2. 어느 상태? */}
        {step === 2 &&
          choice(
            "2. 어느 상태를 입력할 것인가?",
            "프리스트림 = 충격파 앞 원류. 엣지 = 경계층 바로 바깥(충격파 뒤) 유동.",
            inputs.flowLevel,
            [
              {
                id: "freestream",
                title: "프리스트림 (freestream)",
                desc:
                  deriveGeometry(inputs).kind === "flat_plate"
                    ? "평판: 프리스트림이 곧 엣지 조건"
                    : deriveGeometry(inputs).kind === "cone"
                      ? "콘: Taylor–Maccoll로 엣지 자동 계산"
                      : "웨지: 2D oblique shock → 엣지 자동 계산",
              },
              {
                id: "edge",
                title: "엣지 (edge)",
                desc: "이미 알고 있는 경계층 외연 조건을 직접 입력",
              },
            ],
            setFlowLevel
          )}

        {/* 3. 어떻게 입력? */}
        {step === 3 &&
          choice(
            "3. 그 상태를 어떻게 입력할 것인가?",
            `${stateName} 조건을 아래 두 형식 중 하나로 넣습니다.`,
            inputs.inputMode,
            [
              {
                id: "mode_a",
                title: "M + Re + h_tot",
                desc: "마하수, Re [×10⁶/m], h_tot [MJ/kg] (또는 T₀ [K])",
              },
              {
                id: "mode_b",
                title: "u + p + T",
                desc: "속도, 압력, 온도 (정적)",
              },
            ],
            setInputMode
          )}

        {/* 4. 수치 */}
        {step === 4 && (
          <div>
            <p className="step-lead">4. {stateName} 수치 입력</p>
            {inputs.flowLevel === "freestream" && (
              <p className="step-hint">
                {deriveGeometry(inputs).kind === "flat_plate" &&
                  "평판: 입력한 프리스트림이 그대로 경계층 엣지 조건입니다."}
                {deriveGeometry(inputs).kind === "wedge" &&
                  "웨지: 프리스트림 → 2D oblique shock (θ = 웨지각) → 엣지 → 경계층."}
                {deriveGeometry(inputs).kind === "cone" &&
                  "콘: 프리스트림 → Taylor–Maccoll (반각) → 엣지 → 경계층."}
              </p>
            )}
            {inputs.flowLevel === "edge" && (
              <p className="step-hint">입력한 값이 경계층 계산의 엣지 조건이 됩니다.</p>
            )}
            <ValueFields inputs={inputs} onChange={onChange} />
          </div>
        )}

        {step === 5 && (
          <div>
            <p className="step-lead">5. 벽 온도 T_w</p>
            {numField("T_w [K]", "등온 벽", inputs.T_w, (T_w) => onChange({ T_w }), { min: 1 })}
          </div>
        )}

        {step === 6 && (
          <div>
            <p className="step-lead">6. 스트림 위치 x</p>
            {numField("선택 x [m]", "", inputs.x_sel, (x_sel) => onChange({ x_sel }))}
            {numField("x min [m]", "", inputs.x_min, (x_min) => onChange({ x_min }))}
            {numField("x max [m]", "", inputs.x_max, (x_max) => onChange({ x_max }))}
            <label className="field">
              <span className="field-label">경계층 그림 과장 배율</span>
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
