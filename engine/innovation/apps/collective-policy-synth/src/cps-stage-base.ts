import { css, html, nothing } from 'lit';
import { property, customElement, state } from 'lit/decorators.js';

import './@yrpri/common/yp-image.js';
import { YpFormattingHelpers } from './@yrpri/common/YpFormattingHelpers.js';
import { YpBaseElement } from './@yrpri/common/yp-base-element.js';

import '@material/web/checkbox/checkbox.js';
import { Checkbox } from '@material/web/checkbox/lib/checkbox.js';
import '@material/web/button/outlined-button.js';
import '@material/web/circularprogress/circular-progress.js';

export abstract class CpsStageBase extends YpBaseElement {
  @property({ type: Object })
  memory: IEngineInnovationMemoryData;

  @property({ type: Boolean })
  showEloRatings = false;

  @state()
  displayStates = new Map();
  toggleDisplayState(title: string) {
    const currentState = this.displayStates.get(title);
    this.displayStates.set(title, !currentState);
    this.requestUpdate();
  }

  toggleScores() {
    const checkbox = this.$$('#showScores') as Checkbox;
    this.showEloRatings = checkbox.checked;
    window.appGlobals.activity(
      `View memory - toggle scores ${this.showEloRatings ? 'on' : 'off'}`
    );
  }

  static get styles() {
    return [
      super.styles,
      css`
        .title {
          font-size: 22px;
          letter-spacing: 0.22em;
          line-height: 1.7;
          color: var(--md-sys-color-primary);
          background-color: var(--md-sys-color-on-primary);
          padding: 16px;
          margin-top: 16px;
          border-radius: 16px;
          margin-bottom: 8px;
        }

        .subTitle {
        }

        .profileImage {
          width: 50px;
          height: 50px;
          min-height: 50px;
          min-width: 50px;
          margin-right: 8px;
        }

        .row {
          padding: 8px;
          margin: 8px;
          border-radius: 16px;
          background-color: var(--md-sys-color-on-primary);
          color: var(--md-sys-color-primary);

          min-width: 350px;
          width: 550px;

          font-size: 16px;
          vertical-align: center;

          padding-bottom: 16px;
        }

        .row[current-user] {
          background-color: var(--md-sys-color-teriary);
          color: var(--md-sys-color-on-primary);
        }

        .column {
          padding: 8px;
        }

        .index {
          font-size: 16px;
        }

        .ideaName {
          padding-bottom: 0;
          width: 100%;
        }

        .nameAndScore {
          width: 100%;
        }

        .scores {
          margin-top: 16px;
          padding: 16px;
          padding-top: 12px;
          padding-bottom: 12px;
          margin-bottom: 0px;
          text-align: center;
          background-color: var(--md-sys-color-surface-variant);
          color: var(--md-sys-color-on-surface-variant);
          border-radius: 24px;
          font-size: 14px;
          line-height: 1.2;
        }

        .checkboxText {
          color: var(--md-sys-color-primary);
          margin-top: 14px;
        }

        md-checkbox {
          padding-bottom: 8px;
        }

        .loading {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          height: 100vh;
        }

        .scores[hidden] {
          display: none;
        }

        .winLosses {
          margin-top: 4px;
        }

        .scoreAndNameContainer {
          width: 100%;
        }

        .exportButton {
          margin-bottom: 128px;
          margin-top: 32px;
        }

        .queryType {
          font-size: 18px;
          margin-top: 16px;
          margin-bottom: 8px;
        }

        .query {
          font-size: 16px;
          margin-bottom: 4px;
        }

        .card {
          padding: 16px;
          margin: 8px;
          border-radius: 8px;
          background-color: var(--md-sys-color-on-primary);
          color: var(--md-sys-color-primary);
        }

        .description,
        .url,
        .eloRating {
          margin-top: 8px;
          margin-bottom: 4px;
        }

        @media (min-width: 960px) {
          .queryType {
            font-size: 20px;
            margin-top: 20px;
            margin-bottom: 10px;
          }

          .query {
            font-size: 18px;
            margin-bottom: 6px;
          }

          .card {
            padding: 20px;
            margin: 10px;
            border-radius: 10px;
          }

          .description,
          .url,
          .eloRating {
            margin-top: 10px;
            margin-bottom: 6px;
          }
        }

        @media (max-width: 960px) {
          .queryType {
            font-size: 16px;
            margin-top: 12px;
            margin-bottom: 6px;
          }

          .query {
            font-size: 14px;
            margin-bottom: 3px;
          }

          .card {
            padding: 12px;
            margin: 6px;
            border-radius: 6px;
          }

          .description,
          .url,
          .eloRating {
            margin-top: 6px;
            margin-bottom: 3px;
          }
        }

        @media (min-width: 960px) {
          .questionTitle {
            margin-bottom: 16px;
          }
        }

        @media (max-width: 960px) {
          .loading {
            width: 100vw;
            height: 100vh;
          }

          .title {
            font-size: 18px;
            letter-spacing: 0.15em;
            line-height: 1.5;
            margin-top: 16px;
          }

          .row {
            min-width: 300px;
            width: 300px;
          }
        }
      `,
    ];
  }

  renderSearchQueries(title: string, searchQueries: IEngineSearchQueries) {
    if (!searchQueries) {
      return nothing;
    }

    return html`
      <div
        class="title"
        @click="${(e: Event) => {
          e.stopPropagation();
          this.toggleDisplayState(title);
        }}"
      >
        ${title}
        <span class="icon">🔽</span>
      </div>
      ${this.displayStates.get(title)
        ? Object.entries(searchQueries).map(([type, queries]) => {
            if (queries.length === 0) {
              return nothing;
            }

            return html`
              <div class="queryType">${type}</div>
              ${queries.map((query: string) => {
                return html`
                  <div class="row">
                    <div class="column">
                      <div class="query">${query}</div>
                    </div>
                  </div>
                `;
              })}
            `;
          })
        : nothing}
    `;
  }

  renderSearchResults(title: string, searchResults: IEngineSearchResults) {
    if (!searchResults || !searchResults.pages) {
      return nothing;
    }

    return html`
      <div
        class="title"
        @click="${(e: Event) => {
          e.stopPropagation();
          this.toggleDisplayState(title);
        }}"
      >
        ${title}
        <span class="icon">🔽</span>
      </div>
      ${this.displayStates.get(title)
        ? Object.entries(searchResults.pages).map(([type, results]) => {
            if (results.length === 0) {
              return nothing;
            }

            return html`
              <div class="resultType">${type}</div>
              ${results.map((result: IEngineSearchResultItem) => {
                return html`
                  <div class="card">
                    <div class="title">${result.title}</div>
                    <div class="description">${result.description}</div>
                    <div class="url">${result.url}</div>
                    <div class="eloRating">${result.eloRating ?? 'N/A'}</div>
                  </div>
                `;
              })}
            `;
          })
        : nothing}
    `;
  }
}
