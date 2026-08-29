# Model Weights Directory

This directory stores the fine-tuned neural network weights for the MentalWelfare platform.

## Model Structure
```
outputs/
â”œâ”€â”€ model_ultimate_context/          # 135M Causal LLM (LLaMA architecture)
â”‚   â”œâ”€â”€ chat_template.jinja
â”‚   â”œâ”€â”€ config.json
â”‚   â”œâ”€â”€ generation_config.json
â”‚   â”œâ”€â”€ tokenizer.json
â”‚   â”œâ”€â”€ tokenizer_config.json
â”‚   â””â”€â”€ model.safetensors           # Downloaded via Git LFS
â””â”€â”€ transformer_router_final/        # 66M DistilBERT Intent Router
    â”œâ”€â”€ config.json
    â”œâ”€â”€ tokenizer.json
    â”œâ”€â”€ tokenizer_config.json
    â”œâ”€â”€ training_args.bin
    â””â”€â”€ model.safetensors           # Downloaded via Git LFS
```

## Downloading Model Weights via Git LFS
If you cloned the repository without Git LFS installed, pull the weights using:
```bash
git lfs install
git lfs pull
```
Alternatively, place your custom fine-tuned `model.safetensors` files directly into their respective folders (`model_ultimate_context` and `transformer_router_final`).

