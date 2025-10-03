// 공통 에이전트 클라이언트: 렌더러에서 window.jarvisAPI 브리지를 일원화

export class AgentClient {
  static ensureBridge() {
    if (typeof window === 'undefined' || !window.jarvisAPI) {
      const error = new Error('VORAN API를 사용할 수 없습니다. Electron 환경에서 실행해주세요.');
      error.code = 'AGENT_BRIDGE_MISSING';
      throw error;
    }
    return window.jarvisAPI;
  }

  static async request(channel, payload = {}) {
    const bridge = AgentClient.ensureBridge();
    if (typeof bridge[channel] !== 'function') {
      const error = new Error(`알 수 없는 에이전트 채널: ${channel}`);
      error.code = 'AGENT_CHANNEL_INVALID';
      throw error;
    }
    const result = await bridge[channel](payload);
    if (!result?.success) {
      const message = result?.error?.message || '에이전트 요청에 실패했습니다.';
      const error = new Error(message);
      error.code = result?.error?.code || 'AGENT_REQUEST_FAILED';
      throw error;
    }
    return result;
  }

  static async askRoot({ messages, model, temperature, maxTokens } = {}) {
    return AgentClient.request('askRoot', { messages, model, temperature, maxTokens });
  }

  static async askChild({ messages, model, temperature, maxTokens } = {}) {
    return AgentClient.request('askChild', { messages, model, temperature, maxTokens });
  }
}

export default AgentClient;


