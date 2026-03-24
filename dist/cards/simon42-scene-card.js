// ====================================================================
// SIMON42 SCENE CARD - Persistent Scene Save/Restore
// ====================================================================
// Speichert den aktuellen Zustand von Licht-Entitäten als persistente
// Szene über die HA Config API (überlebt Neustarts).
// ====================================================================

class Simon42SceneCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._rendered = false;
  }

  setConfig(config) {
    if (!config.area_id || !config.area_name || !config.entities) {
      throw new Error("simon42-scene-card requires area_id, area_name, and entities");
    }
    this._config = config;
    this._sceneName = config.area_name + ' Lichtstimmung';
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this._render();
    }
  }

  get hass() {
    return this._hass;
  }

  _render() {
    this._rendered = true;

    this.innerHTML = `
      <ha-card>
        <div class="scene-buttons">
          <button class="scene-btn save-btn" id="save-btn">
            <ha-icon icon="mdi:content-save-outline"></ha-icon>
            <span>Lichtstimmung speichern</span>
          </button>
          <button class="scene-btn restore-btn" id="restore-btn">
            <ha-icon icon="mdi:restore"></ha-icon>
            <span>Lichtstimmung wiederherstellen</span>
          </button>
        </div>
      </ha-card>
      <style>
        ha-card {
          padding: 8px;
        }
        .scene-buttons {
          display: flex;
          gap: 8px;
        }
        .scene-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 12px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 12px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #212121);
          cursor: pointer;
          font-size: 13px;
          font-family: var(--ha-card-font-family, inherit);
          transition: background 0.2s, color 0.2s;
        }
        .scene-btn:hover {
          background: var(--secondary-background-color, #f5f5f5);
        }
        .scene-btn:active {
          background: var(--primary-color, #03a9f4);
          color: var(--text-primary-color, #fff);
        }
        .scene-btn ha-icon {
          --mdc-icon-size: 18px;
        }
        .scene-btn.success {
          background: var(--success-color, #4caf50);
          color: white;
          border-color: var(--success-color, #4caf50);
        }
        .scene-btn.error {
          background: var(--error-color, #f44336);
          color: white;
          border-color: var(--error-color, #f44336);
        }
      </style>
    `;

    this.querySelector('#save-btn').addEventListener('click', () => this._saveScene());
    this.querySelector('#restore-btn').addEventListener('click', () => this._restoreScene());
  }

  _collectLightStates() {
    const entities = {};
    const captureAttrs = [
      'brightness', 'color_temp', 'color_temp_kelvin',
      'rgb_color', 'rgbw_color', 'rgbww_color',
      'hs_color', 'xy_color', 'color_mode', 'effect'
    ];

    for (const entityId of this._config.entities) {
      const state = this._hass.states[entityId];
      if (!state) continue;

      const entry = { state: state.state };

      if (state.state === 'on') {
        for (const attr of captureAttrs) {
          if (state.attributes[attr] !== undefined && state.attributes[attr] !== null) {
            entry[attr] = state.attributes[attr];
          }
        }
      }

      entities[entityId] = entry;
    }

    return entities;
  }

  _findExistingScene() {
    // Suche eine existierende Szene anhand des Namens
    for (const [entityId, state] of Object.entries(this._hass.states)) {
      if (entityId.startsWith('scene.') && state.attributes?.friendly_name === this._sceneName) {
        return { entityId, configId: state.attributes?.id };
      }
    }
    return null;
  }

  async _saveScene() {
    const btn = this.querySelector('#save-btn');
    const originalText = btn.querySelector('span').textContent;

    try {
      const entities = this._collectLightStates();
      const sceneConfig = {
        name: this._sceneName,
        entities: entities,
        icon: 'mdi:lightbulb-group-outline'
      };

      const existing = this._findExistingScene();

      if (existing?.configId) {
        await this._hass.callApi('PUT', `config/scene/config/${existing.configId}`, sceneConfig);
      } else {
        await this._hass.callApi('POST', 'config/scene/config', sceneConfig);
      }

      btn.classList.add('success');
      btn.querySelector('span').textContent = 'Gespeichert!';
      btn.querySelector('ha-icon').setAttribute('icon', 'mdi:check');
    } catch (err) {
      console.error('simon42-scene-card: Fehler beim Speichern:', err);
      btn.classList.add('error');
      btn.querySelector('span').textContent = 'Fehler!';
    }

    setTimeout(() => {
      btn.classList.remove('success', 'error');
      btn.querySelector('span').textContent = originalText;
      btn.querySelector('ha-icon').setAttribute('icon', 'mdi:content-save-outline');
    }, 2000);
  }

  async _restoreScene() {
    const btn = this.querySelector('#restore-btn');
    const originalText = btn.querySelector('span').textContent;

    try {
      const existing = this._findExistingScene();

      if (!existing) {
        btn.classList.add('error');
        btn.querySelector('span').textContent = 'Keine Szene gefunden';
        setTimeout(() => {
          btn.classList.remove('error');
          btn.querySelector('span').textContent = originalText;
        }, 2000);
        return;
      }

      await this._hass.callService('scene', 'turn_on', {
        entity_id: existing.entityId
      });

      btn.classList.add('success');
      btn.querySelector('span').textContent = 'Wiederhergestellt!';
      btn.querySelector('ha-icon').setAttribute('icon', 'mdi:check');
    } catch (err) {
      console.error('simon42-scene-card: Fehler beim Wiederherstellen:', err);
      btn.classList.add('error');
      btn.querySelector('span').textContent = 'Fehler!';
    }

    setTimeout(() => {
      btn.classList.remove('success', 'error');
      btn.querySelector('span').textContent = originalText;
      btn.querySelector('ha-icon').setAttribute('icon', 'mdi:restore');
    }, 2000);
  }

  getCardSize() {
    return 1;
  }
}

customElements.define('simon42-scene-card', Simon42SceneCard);
