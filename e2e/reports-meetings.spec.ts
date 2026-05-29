import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("cwf-intro-seen", "true");

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => new MediaStream(),
      },
    });

    type FakeSpeechResult = Array<{ transcript: string }> & { isFinal: boolean };
    type FakeSpeechEvent = { resultIndex: number; results: FakeSpeechResult[] };

    class FakeMediaRecorder extends EventTarget {
      static isTypeSupported() {
        return true;
      }

      mimeType = "audio/webm";
      state: RecordingState = "inactive";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: ((event: Event) => void) | null = null;

      start() {
        this.state = "recording";
      }

      requestData() {
        const event = new BlobEvent("dataavailable", { data: new Blob(["audio"], { type: "audio/webm" }) });
        this.ondataavailable?.(event);
        this.dispatchEvent(event);
      }

      stop() {
        this.state = "inactive";
        this.onstop?.(new Event("stop"));
      }

      pause() {
        this.state = "paused";
      }

      resume() {
        this.state = "recording";
      }
    }

    class FakeSpeechRecognition {
      lang = "pt-BR";
      continuous = true;
      interimResults = true;
      onresult: ((event: FakeSpeechEvent) => void) | null = null;
      onend: (() => void) | null = null;

      start() {
        window.setTimeout(() => {
          const result = [{ transcript: "Ficou decidido revisar receitas de maio e validar RPAs" }] as FakeSpeechResult;
          result.isFinal = true;
          this.onresult?.({ resultIndex: 0, results: [result] });
        }, 60);
      }

      stop() {
        this.onend?.();
      }
    }

    window.MediaRecorder = FakeMediaRecorder as unknown as typeof MediaRecorder;
    const speechWindow = window as Window & {
      SpeechRecognition?: typeof FakeSpeechRecognition;
      webkitSpeechRecognition?: typeof FakeSpeechRecognition;
    };
    speechWindow.SpeechRecognition = FakeSpeechRecognition;
    speechWindow.webkitSpeechRecognition = FakeSpeechRecognition;
  });
});

test("fluxo recorrente de relatorios e reunioes", async ({ page }) => {
  await page.goto("/relatorios-reunioes-e2e");

  await expect(page.getByRole("heading", { name: /Relatorios e reunioes/i })).toBeVisible();

  await page.getByRole("button", { name: /Gerar relatorio pre-reuniao/i }).click();
  await expect(page.getByText(/Mai2026 analisada/i).first()).toBeVisible();
  await expect(page.getByText("DRE offline pronta", { exact: true })).toBeVisible();
  await expect(page.getByText(/dre-offline-2026-05\.xlsx/i).first()).toBeVisible();

  await page.getByRole("button", { name: /^Iniciar reuniao/i }).nth(1).click();
  await expect(page.getByText(/Status: recording/i)).toBeVisible();
  await expect(page.getByText(/validar RPAs/i)).toBeVisible();

  await page.getByPlaceholder(/Cole complemento/i).fill(
    "Cliente pediu DRE offline ate sexta. Ana responsavel por conferir Simples Nacional em 10/06.",
  );
  await page.getByRole("button", { name: /Finalizar reuniao/i }).click();

  await expect(page.getByText(/Resumo inteligente pos-reuniao/i)).toBeVisible();
  await expect(page.getByText(/Comparacao relatorio x reuniao/i)).toBeVisible();
  await expect(page.getByText("Solicitacoes", { exact: true })).toBeVisible();
  await expect(page.getByText("Conferencias", { exact: true })).toBeVisible();
});
