import { css, html, nothing } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import './@yrpri/common/yp-image.js';
import { CpsStageBase } from './cps-stage-base.js';

import '@material/web/chips/chip-set.js';
import '@material/web/chips/filter-chip.js';
import '@material/web/iconbutton/standard-icon-button.js';

//TDOO: Share from db config
const maxNumberOfSubProblems = 7;

@customElement('cps-solutions')
export class CpsSolutions extends CpsStageBase {
  async connectedCallback() {
    super.connectedCallback();
    window.appGlobals.activity(`Solutions - open`);
  }

  updated(changedProperties: Map<string | number | symbol, unknown>): void {
    super.updated(changedProperties);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.appGlobals.activity(`Solutions - close`);
  }

  static get styles() {
    return [
      super.styles,
      css`
        .topContainer {
          margin-right: 32px;
        }

        .prominentSubProblem {
          cursor: pointer;
        }

        .problemStatement {
          font-size: 22px;
          padding: 16px;
          margin: 16px 0;
          border-radius: 16px;
          line-height: 1.4;
          background-color: var(--md-sys-color-tertiary);
          color: var(--md-sys-color-on-tertiary);
          max-width: 960px;
        }

        .problemStatementText {
          padding: 16px;
        }

        .subProblemStatement,
        .subProblemTitle {
          font-size: 22px;
          padding: 8px;
          margin: 8px 0;
          border-radius: 12px;
          line-height: 1.4;
          max-width: 960px;
        }

        .subProblemTitle {
          color: var(--md-sys-color-primary);
          font-weight: bold;
          letter-spacing: 0.12em;
          padding-bottom: 0;
        }

        .subProblem {
          opacity: 1;
          border-radius: 12px;
          padding: 16px;
          margin: 16px 0;
          background-color: var(--md-sys-color-on-primary);
          color: var(--md-sys-color-primary);
          max-width: 960px;
        }

        .title {
          font-size: 28px;
          margin-bottom: 8px;
          color: var(--md-sys-color-secondary);
          background-color: var(--md-sys-color-on-secondary);
          text-align: center;
          max-width: 960px;
          width: 100%;
        }

        .subProblem.lessProminent {
          opacity: 0.75;
        }

        /* New CSS rules */

        button {
          margin: 5px;
          padding: 10px;
          border: none;
          background-color: #ddd;
          cursor: pointer;
          border-radius: 5px;
        }

        button:hover {
          background-color: #ccc;
        }

        .solutionAttributes {
          display: flex;
          justify-content: space-between;
        }

        .pros,
        .cons {
          width: 45%;
          border: 1px solid #ddd;
          border-radius: 5px;
          padding: 10px;
          margin: 10px 0;
        }

        @media (max-width: 600px) {
          .solutionAttributes {
            flex-direction: column;
          }
        }
      `,
    ];
  }

  render() {
    const subProblems = this.memory.subProblems || [];
    if (this.activeSolutionIndex !== undefined) {
      return this.renderSolutionScreen(this.activeSolutionIndex);
    } else if (this.activeSubProblemIndex !== undefined) {
      return this.renderSubProblemScreen(
        subProblems[this.activeSubProblemIndex]
      );
    } else {
      return this.renderSubProblemList(subProblems);
    }
  }

  renderSubProblemList(subProblems: IEngineSubProblem[]) {
    return html`
      <div class="topContainer layout vertical center-center">
        ${this.renderProblemStatement()}

        <div class="title">${this.t('Sub Problems')}</div>
        ${subProblems.map((subProblem, index) => {
          const isLessProminent = index >= maxNumberOfSubProblems;
          return this.renderSubProblem(subProblem, isLessProminent, index);
        })}
      </div>
    `;
  }

  renderSubProblemScreen(subProblem: IEngineSubProblem) {
    return html`
      <div class="topContainer layout vertical">
        <div class="layout horizontal">
          <md-standard-icon-button
            aria-label="Close"
            @click="${(): void => (this.activeSubProblemIndex = undefined)}"
          >
            <md-icon>close</md-icon>
          </md-standard-icon-button>
          <h2>${subProblem.title}</h2>
        </div>
        <md-chip-set type="filter" single-select>
          ${subProblem.solutions.populations.map(
            (population, index) =>
              html`
                <md-filter-chip
                  label="Generation ${index + 1}"
                  @click="${() => (this.activePopulationIndex = index)}"
                ></md-filter-chip>
              `
          )}
        </md-chip-set>
        ${subProblem.solutions.populations[this.activePopulationIndex].map(
          (solution, index) =>
            html`<div
              @click="${(): void => {
                this.activeSolutionIndex = index;
              }}"
            >
              ${solution.title}
            </div>`
        )}
      </div>
    `;
  }

  renderSolutionScreen(solutionIndex: number) {
    const solutions =
      this.memory.subProblems[this.activeSubProblemIndex].solutions.populations[
        this.activePopulationIndex
      ];
    const solution = solutions[solutionIndex];
    return html`
      <div class="topContainer">
        <md-standard-icon-button
          aria-label="Previous"
          @click="${(): void => {
            if (solutionIndex > 0) {
              this.activeSolutionIndex = solutionIndex - 1;
            }
          }}"
        >
          <md-icon>navigate_before</md-icon>
        </md-standard-icon-button>
        <md-standard-icon-button
          aria-label="Next"
          @click="${(): void => {
            if (solutionIndex < solutions.length - 1) {
              this.activeSolutionIndex = solutionIndex + 1;
            }
          }}"
        >
          <md-icon>navigate_next</md-icon>
        </md-standard-icon-button>
        <md-standard-icon-button
          aria-label="Close"
          @click="${(): void => (this.activeSolutionIndex = undefined)}"
        >
          <md-icon>close</md-icon>
        </md-standard-icon-button>
        <h2>${solution.title}</h2>
        <div class="solutionDescription">${solution.description}</div>
        <div class="solutionExtraInfo">
          <b>${this.t('Main benefit')}:</b> ${solution.mainBenefitOfSolution}
        </div>
        <div class="solutionExtraInfo">
          <b>${this.t('Main obsticle to adoption')}:</b>
          ${solution.mainObstacleToSolutionAdoption}
        </div>
        <div class="solutionAttributes layout horizontal wrap">
          <div class="pros flexFactor">
            <div class="prosConsHeader">${this.t('Pros')}</div>
            <ul>
              ${(solution.pros as IEngineProCon[]).map(
                pro => html`<li>${pro.description}</li>`
              )}
            </ul>
          </div>
          <div class="cons flexFactor">
            <div class="prosConsHeader">${this.t('Cons')}</div>
            <ul>
              ${(solution.cons as IEngineProCon[]).map(
                con => html`<li>${con.description}</li>`
              )}
            </ul>
          </div>
        </div>
      </div>
    `;
  }
}
