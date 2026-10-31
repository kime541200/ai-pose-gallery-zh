# 接上本地 ComfyUI 生圖

「合成台」的 `本地 ComfyUI` 協議：把人像／服裝／姿勢（最多 3 張）當參考圖，交給 **Qwen-Image-Edit-2509** 做多圖編輯。不需要任何付費 API。

## 流程

瀏覽器 → 同源 `/comfy/*`（nginx 或 Vite dev proxy）→ 你的 ComfyUI：
`POST /upload/image` → `POST /prompt` → 輪詢 `/history/{id}` → `GET /view`。
實作見 `src/services/comfyui.ts`；workflow 模板為 `src/workflows/qwen-image-edit-2509.api.json`（ComfyUI API 格式，可直接餵給 `validate_workflow`／`run_workflow`，`{{PROMPT}}` 與 `image1.png` 等為佔位）。

### 為什麼姿勢圖會先經過 `DepthAnythingV2 → DWPose`？

本庫的姿勢參考圖是白底黑線的球形關節素體（含臉部十字線與關節球）。若直接將素體圖作為 VAE reference latent 送進 `Qwen-Image-Edit-2509`，模型會將它視為線稿控制（Lineart Control），把人偶關節與臉部十字線直接畫進人物身上。

因此工作流會在有選取姿勢圖時，自動以 `comfyui_controlnet_aux` 的 `DepthAnythingV2Preprocessor`（抹除素體內部關節線、轉為立體深度輪廓）串接 `DWPreprocessor`（擷取全身與手部 OpenPose 關鍵點骨架），再送入 `TextEncodeQwenImageEditPlus` 的 `image3`，走 Qwen-Image-Edit-2509 原生的「多圖關鍵點穿衣姿勢」模式。

## 需要的 ComfyUI 條件

- ComfyUI ≥ 0.4x（內建 `TextEncodeQwenImageEditPlus`、`CFGNorm`）
- custom nodes（對應 `comfyui-deploy` 的 `PROFILE=pose-gallery`）：
  - `ComfyUI-GGUF`（`UnetLoaderGGUF`）
  - `comfyui_controlnet_aux`（`DepthAnythingV2Preprocessor`、`DWPreprocessor`；首次執行會自動拉取對應預處理權重）
- 模型（放在 ComfyUI 的 `models/` 下，16 GB 顯存實測約 50–80 秒／張）：

| 路徑 | 來源 | 大小 |
| --- | --- | --- |
| `unet/qwen-image-edit/Qwen-Image-Edit-2509-Q4_K_M.gguf` | `QuantStack/Qwen-Image-Edit-2509-GGUF` | 13.07 GB |
| `text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors` | `Comfy-Org/Qwen-Image_ComfyUI` | 9.38 GB |
| `vae/qwen_image_vae.safetensors` | `Comfy-Org/Qwen-Image_ComfyUI` | 0.25 GB |
| `loras/qwen-image-edit/Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors` | `lightx2v/Qwen-Image-Lightning` | 0.85 GB |

Lightning LoRA 讓步數降為 4、CFG 為 1；不想用就在設定頁把 lora 欄位清空，並自行調高步數與 CFG。

## 連線設定

- Docker：`COMFYUI_UPSTREAM=http://<你的 ComfyUI>:8188 docker compose up -d --build`（預設 `http://host.docker.internal:8188`）
- 開發：`COMFYUI_UPSTREAM=http://127.0.0.1:8188 pnpm dev`
- 網頁「API 配置」→ 本地 ComfyUI：Base URL 保持 `/comfy`；檔名須與實際安裝一致。
