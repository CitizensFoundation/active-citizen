import { css, html, nothing } from 'lit';
import { property, customElement } from 'lit/decorators.js';

import './@yrpri/common/yp-image.js';

import { CpsStageBase } from './cps-stage-base.js';

//TDOO: Share from db config
const maxNumberOfSubProblems = 7;
const maxNumberOfTopEntities = 3;

@customElement('cps-entities')
export class CpsEntities extends CpsStageBase {
  @property({ type: Number }) selectedSubProblemIndex: number | undefined;

  async connectedCallback() {
    super.connectedCallback();
    window.appGlobals.activity(`Sub Problems - open`);
  }

  updated(changedProperties: Map<string | number | symbol, unknown>): void {
    super.updated(changedProperties);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.appGlobals.activity(`Sub Problems - close`);
  }

  static get styles() {
    return [
      super.styles,
      css`
        .problemStatement {
          font-size: 22px;
          padding: 16px;
          margin: 32px 0;
          background-color: var(--md-sys-color-surface-variant);
          color: var(--md-sys-color-on-surface-variant);
          border-radius: 16px;
          line-height: 1.6;
        }

        .subProblemStatement {
          font-size: 18px;
          padding: 12px;
          margin: 28px 0;
          background-color: var(--md-sys-color-surface-variant);
          color: var(--md-sys-color-on-surface-variant);
          border-radius: 12px;
          line-height: 1.4;
        }

        .title {
          font-size: 28px;
          margin-bottom: 24px;
          color: var(--md-sys-color-primary);
          text-decoration: underline;
        }

        .subProblem {
          opacity: 1;
          background-color: var(--md-sys-color-surface-variant);
          border-radius: 12px;
          padding: 16px;
          margin: 16px 0;
          box-shadow: 0px 3px 6px #00000029;
        }

        .subProblem.lessProminent {
          opacity: 0.6;
        }

        .entity {
          opacity: 1;
          background-color: var(--md-sys-color-surface-variant);
          border-radius: 12px;
          padding: 16px;
          margin: 16px 0;
          box-shadow: 0px 3px 6px #00000029;
        }

        .entity.lessProminent {
          opacity: 0.6;
        }
      `,
    ];
  }

  render() {
    const subProblems = this.memory.subProblems || [];
    return html`
      <div class="topContainer layout vertical">
        <div class="title">${this.t('Problem Statement')}</div>
        <div class="problemStatement">
          ${this.memory.problemStatement.description}
        </div>

        <div class="title">${this.t('Sub Problems')}</div>
        ${subProblems.map((subProblem, index) => {
          const isLessProminent = index >= maxNumberOfSubProblems;
          return html`
            <div
              class="subProblem ${isLessProminent ? 'lessProminent' : ''}"
              @click=${() =>
                this.selectedSubProblemIndex === index
                  ? (this.selectedSubProblemIndex = undefined)
                  : (this.selectedSubProblemIndex = index)}
            >
              <div class="subProblemStatement">${subProblem.description}</div>
              ${this.selectedSubProblemIndex === index
                ? subProblem.entities.map((entity, entityIndex) => {
                    const isEntityLessProminent =
                      entityIndex >= maxNumberOfTopEntities;
                    return html`
                      <div
                        class="entity ${isEntityLessProminent
                          ? 'lessProminent'
                          : ''}"
                      >
                        <div>${entity.name}</div>
                        <div>ELO Rating: ${entity.eloRating || 'N/A'}</div>
                        ${entity.negativeEffects?.length > 0
                          ? html`
                              <div>
                                Negative Effects:
                                ${entity.negativeEffects?.join(', ') || 'N/A'}
                              </div>
                            `
                          : nothing}
                        ${entity.positiveEffects?.length > 0
                          ? html`
                              <div>
                                Positive Effects:
                                ${entity.positiveEffects?.join(', ') || 'N/A'}
                              </div>
                            `
                          : nothing}
                        ${!isEntityLessProminent
                          ? html`
                              ${this.renderSearchQueries(
                                this.t('Search queries for entity'),
                                entity.searchQueries
                              )}
                              ${this.renderSearchResults(
                                this.t('Search results for entity'),
                                entity.searchResults
                              )}
                            `
                          : nothing}
                      </div>
                    `;
                  })
                : nothing}
            </div>
          `;
        })}
      </div>
    `;
  }
}
