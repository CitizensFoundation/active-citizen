import { css, html, nothing } from 'lit';
import { property, customElement } from 'lit/decorators.js';

import './@yrpri/common/yp-image.js';

import '@material/web/checkbox/checkbox.js';
import { Checkbox } from '@material/web/checkbox/lib/checkbox.js';
import '@material/web/button/outlined-button.js';
import '@material/web/circularprogress/circular-progress.js';
import { CpsStageBase } from './cps-stage-base.js';

@customElement('cps-problem-statement')
export class CpsProblemStatement extends CpsStageBase {
  async connectedCallback() {
    super.connectedCallback();
    window.appGlobals.activity(`Problem Statment - open`);
  }

  updated(changedProperties: Map<string | number | symbol, unknown>): void {
    super.updated(changedProperties);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.appGlobals.activity(`Problem Statment - close`);
  }

  static get styles() {
    return [
      super.styles,
      css`
        .problemStatement {
          font-size: 26px;
          padding: 16px;
          margin: 32px 0;
          background-color: var(--md-sys-color-surface-variant);
          color: var(--md-sys-color-on-surface-variant);
          border-radius: 16px;
          line-height: 1.6;
        }

        .title {
          font-size: 32px;
          margin-bottom: 24px;
          color: var(--md-sys-color-primary);
          text-decoration: underline;
        }
      `,
    ];
  }

  render() {
    return html`
      <div class="topContainer layout vertical center-center">
        <div class="title">${this.t('Problem Statement')}</div>
        <div class="problemStatment">
          ${this.memory.problemStatement.description}
        </div>

        ${this.renderSearchQueries(
          this.t('Search queries for problem statement'),
          this.memory.problemStatement.searchQueries
        )}
        ${this.renderSearchResults(
          this.t('Search results for problem statement'),
          this.memory.problemStatement.searchResults
        )}
      </div>
    `;
  }
}
