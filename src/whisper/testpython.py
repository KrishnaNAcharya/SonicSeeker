import torch
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def check_gpu():
    """
    Checks if a CUDA-enabled GPU is available and logs information about it.
    """
    logging.info("Checking for CUDA availability...")
    if torch.cuda.is_available():
        logging.info("CUDA is available! GPU is enabled.")
        logging.info(f"Number of CUDA devices: {torch.cuda.device_count()}")
        current_device = torch.cuda.current_device()
        logging.info(f"Current CUDA device index: {current_device}")
        logging.info(f"Device name: {torch.cuda.get_device_name(current_device)}")
        # Optional: Check memory
        total_mem = torch.cuda.get_device_properties(current_device).total_memory / (1024**3)
        allocated_mem = torch.cuda.memory_allocated(current_device) / (1024**3)
        reserved_mem = torch.cuda.memory_reserved(current_device) / (1024**3)
        logging.info(f"Total GPU Memory: {total_mem:.2f} GB")
        logging.info(f"Allocated GPU Memory: {allocated_mem:.2f} GB")
        logging.info(f"Reserved GPU Memory: {reserved_mem:.2f} GB")
    else:
        logging.warning("CUDA is not available. PyTorch cannot detect a CUDA-enabled GPU.")
        logging.info("Ensure you have installed the correct PyTorch version with CUDA support and that NVIDIA drivers are properly installed.")

if __name__ == "__main__":
    check_gpu()
