import { css, html, nothing } from 'lit';
import { property, customElement } from 'lit/decorators.js';

import './@yrpri/common/yp-image.js';

import { CpsStageBase } from './cps-stage-base.js';

//TDOO: Share from db config
const maxNumberOfSubProblems = 7;

@customElement('cps-sub-problems')
export class CpsSubProblems extends CpsStageBase {
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
    return [super.styles, css``];
  }

  render() {
    const subProblems = this.memory.subProblems || [];
    if (this.activeSubProblemIndex !== undefined) {
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
        ${this.renderSubProblem(subProblem, false, 0)}
        ${this.renderSearchQueries(
          this.t('Search queries for sub problem'),
          subProblem.searchQueries
        )}
        ${this.renderSearchResults(
          this.t('Search results for sub problem'),
          subProblem.searchResults
        )}
      </div>
    `;
  }
}
