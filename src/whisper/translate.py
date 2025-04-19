from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch
from typing import Optional, List, Dict
import langid
import gradio as gr
import sys
import argparse
import os
import time
import base64
import io

# ...existing code...

def check_gpu():
    """Check and print GPU information"""
    if torch.cuda.is_available():
        device = torch.device("cuda")
        gpu_name = torch.cuda.get_device_name(0)
        gpu_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3)  # GB
        print(f"Using GPU: {gpu_name} with {gpu_memory:.2f} GB memory", file=sys.stderr)
        return device
    else:
        print("No GPU detected, using CPU", file=sys.stderr)
        return torch.device("cpu")

class TranscriptTranslator:
    """A translator for transcripts using Facebook's NLLB-200 model."""
    
    # NLLB language code mapping for common languages
    LANGUAGE_CODES = {
        "english": "eng_Latn", 
        "hindi": "hin_Deva",
        "spanish": "spa_Latn",
        "french": "fra_Latn",
        "german": "deu_Latn",
        "chinese": "zho_Hans",
        "japanese": "jpn_Jpan",
        "russian": "rus_Cyrl",
        "arabic": "ara_Arab",
        "kannada": "kan_Knda",  # Add Kannada language support
        # Add more languages as needed
    }
    
    # ...existing code...

    def get_available_languages(self):
        """Return a list of available languages for the UI."""
        return sorted(list(self.LANGUAGE_CODES.keys()))

# ...existing code...

def integrate_with_whisper_ui(translator_instance, whisper_ui_block):
    """
    Integrates translation capabilities with the Whisper transcription UI.
    This function adds language selection and translation display to the transcript section.
    
    Args:
        translator_instance: An instance of the TranscriptTranslator class
        whisper_ui_block: The Gradio block containing the Whisper UI
    """
    with whisper_ui_block:
        # Add a horizontal line to separate transcription and translation
        gr.Markdown("---")
        gr.Markdown("## Translation")
        
        with gr.Row():
            # Language selection dropdown
            target_language = gr.Dropdown(
                choices=translator_instance.get_available_languages(),
                value="english",  # Default language
                label="Translate to",
                interactive=True
            )
            
            # Translate button
            translate_btn = gr.Button("Translate", variant="primary")
        
        # Translation output
        translated_text = gr.Textbox(
            label="Translated Text",
            lines=10,
            interactive=False
        )
        
        # Function to handle translation
        def translate_transcript(transcript, target_lang):
            if not transcript:
                return "No transcript to translate. Please transcribe audio first."
            
            try:
                result = translator_instance.translate(
                    text=transcript,
                    target_language=target_lang,
                    source_language=None  # Auto-detect source
                )
                return result
            except Exception as e:
                return f"Error during translation: {str(e)}"
        
        # Connect the translate button to the translation function
        # This assumes there's a 'transcription' component in the Whisper UI
        # You may need to adjust this based on the actual component ID
        translate_btn.click(
            fn=translate_transcript,
            inputs=["transcription", target_language],  # Update component ID if needed
            outputs=translated_text
        )
        
        # Also update translation when target language changes
        target_language.change(
            fn=translate_transcript,
            inputs=["transcription", target_language],  # Update component ID if needed
            outputs=translated_text
        )
        
        # Example translation
        gr.Examples(
            examples=[
                ["english", "This is an example transcript that will be translated to English."],
                ["spanish", "This is an example transcript that will be translated to Spanish."],
                ["french", "This is an example transcript that will be translated to French."]
            ],
            inputs=[target_language, "transcription"],  # Update component ID if needed
        )

# Add a helper function to detect when a transcript is updated
def on_transcript_update(transcript, current_translation, target_language, translator):
    """Automatically update translation when transcript changes."""
    if not transcript:
        return current_translation
    
    try:
        return translator.translate(
            text=transcript,
            target_language=target_language,
            source_language=None  # Auto-detect
        )
    except:
        # Keep existing translation if error occurs
        return current_translation

# Update the main function to support direct integration with Whisper UI
def setup_translation_for_whisper(whisper_block=None):
    """
    Set up translation capabilities, either standalone or integrated with Whisper.
    
    Args:
        whisper_block: Optional Gradio block for Whisper UI integration
    """
    # Initialize the translator
    translator = TranscriptTranslator()
    
    if whisper_block:
        # Integrate with existing Whisper UI
        integrate_with_whisper_ui(translator, whisper_block)
        return translator
    else:
        # Create standalone UI
        ui = TranslatorUI(translator)
        ui.launch_ui(share=True)
        return translator

# Example of how to integrate with a Whisper UI
# In your Whisper UI file, import and use:
# 
# from translate import setup_translation_for_whisper
# 
# with gr.Blocks() as whisper_ui:
#     # Your existing Whisper UI code...
#     
#     # At the end of your UI definition
#     translator = setup_translation_for_whisper(whisper_ui)

def translate_text(text, target_language, source_language=None):
    """Simple translation function for command-line use"""
    try:
        # Add debug info
        print(f"Starting translation: {len(text)} chars to {target_language}", file=sys.stderr)
        
        # Import necessary modules
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
        import torch
        
        # Check GPU and get appropriate device
        device = check_gpu()
        print(f"Using device: {device}", file=sys.stderr)
        
        # Define language codes - keep in sync with main class
        LANGUAGE_CODES = {
            "english": "eng_Latn", 
            "hindi": "hin_Deva",
            "spanish": "spa_Latn",
            "french": "fra_Latn",
            "german": "deu_Latn",
            "chinese": "zho_Hans",
            "japanese": "jpn_Jpan",
            "russian": "rus_Cyrl",
            "arabic": "ara_Arab",
            "kannada": "kan_Knda",  # Add Kannada language support
        }
        
        # Print setup info
        print(f"Setting up translation from {source_language or 'auto-detect'} to {target_language}", file=sys.stderr)
        
        # Get language codes
        target_lang_code = LANGUAGE_CODES.get(target_language.lower(), target_language)
        
        # Set source language - either provided or English as default
        if source_language:
            src_lang_code = LANGUAGE_CODES.get(source_language.lower(), source_language)
        else:
            # Default to English for simplicity in this command-line version
            src_lang_code = "eng_Latn"
            print(f"Using {src_lang_code} as source language", file=sys.stderr)
        
        # Load model and tokenizer with GPU optimizations
        model_name = "facebook/nllb-200-distilled-600M"
        print(f"Loading model: {model_name} to {device}", file=sys.stderr)
        
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # Optimize loading for GPU usage
        if device.type == "cuda":
            # Use half-precision for better GPU memory efficiency 
            model = AutoModelForSeq2SeqLM.from_pretrained(
                model_name,
                torch_dtype=torch.float16,  # Use FP16 for faster inference
                low_cpu_mem_usage=True      # Optimize memory usage during loading
            ).to(device)
            
            # Clear CUDA cache to free up memory
            torch.cuda.empty_cache()
            print("Using FP16 precision for faster GPU inference", file=sys.stderr)
        else:
            # Standard loading for CPU
            model = AutoModelForSeq2SeqLM.from_pretrained(model_name).to(device)
        
        # Set source language
        tokenizer.src_lang = src_lang_code
        print(f"Tokenizer configured with source language: {src_lang_code}", file=sys.stderr)
        
        # Handle long text by breaking into shorter chunks if needed
        MAX_LENGTH = 512
        
        # Check if text needs chunking
        if len(text) > MAX_LENGTH:
            print(f"Text length ({len(text)}) exceeds maximum. Splitting into chunks.", file=sys.stderr)
            # Simple splitting by sentences
            sentences = text.replace("! ", "!SPLIT").replace("? ", "?SPLIT").replace(". ", ".SPLIT").split("SPLIT")
            chunks = []
            current_chunk = ""
            
            for sentence in sentences:
                if len(current_chunk) + len(sentence) < MAX_LENGTH:
                    current_chunk += sentence + " "
                else:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk = sentence + " "
            
            if current_chunk:
                chunks.append(current_chunk.strip())
            
            print(f"Split into {len(chunks)} chunks", file=sys.stderr)
            
            # Process each chunk separately
            all_results = []
            for i, chunk in enumerate(chunks):
                print(f"Translating chunk {i+1}/{len(chunks)}", file=sys.stderr)
                inputs = tokenizer(chunk, return_tensors="pt", truncation=True).to(device)
                
                with torch.no_grad():
                    try:
                        generated_tokens = model.generate(
                            **inputs,
                            forced_bos_token_id=tokenizer.convert_tokens_to_ids(target_lang_code),
                            max_length=MAX_LENGTH,
                            # Optimized parameters for better quality and speed
                            num_beams=4,
                            length_penalty=1.0,
                            early_stopping=True
                        )
                    
                        result = tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)[0]
                        all_results.append(result)
                        
                    except Exception as chunk_error:
                        print(f"Error translating chunk {i+1}: {chunk_error}", file=sys.stderr)
                        all_results.append(f"[Translation error in this section: {str(chunk_error)}]")
                
                # Clean up GPU memory after each chunk
                if device.type == "cuda":
                    torch.cuda.empty_cache()
            
            # Join all results
            final_result = " ".join(all_results)
            print(f"Translation complete: {len(final_result)} chars", file=sys.stderr)
            return final_result
        else:
            # Process short text directly
            print(f"Translating text (length: {len(text)})", file=sys.stderr)
            inputs = tokenizer(text, return_tensors="pt").to(device)
            
            with torch.no_grad():
                try:
                    generated_tokens = model.generate(
                        **inputs,
                        forced_bos_token_id=tokenizer.convert_tokens_to_ids(target_lang_code),
                        max_length=MAX_LENGTH,
                        # Optimized parameters for better quality and speed
                        num_beams=4,
                        length_penalty=1.0,
                        early_stopping=True
                    )
                
                    result = tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)[0]
                    print(f"Translation complete: {len(result)} chars", file=sys.stderr)
                    
                    # Clean up GPU memory
                    if device.type == "cuda":
                        torch.cuda.empty_cache()
                    
                    return result
                except Exception as direct_error:
                    print(f"Error during direct translation: {direct_error}", file=sys.stderr)
                    return f"[Translation error: {str(direct_error)}]"
            
    except ImportError as e:
        print(f"Import error: {e}", file=sys.stderr)
        print("Try installing missing packages with:", file=sys.stderr)
        print("  pip install transformers torch langid", file=sys.stderr)
        return f"ERROR: Missing required packages: {e}"
    except Exception as e:
        print(f"Error during translation: {e}", file=sys.stderr)
        # Return the error message so we can at least see something in the frontend
        return f"ERROR: Translation failed: {e}"

if __name__ == "__main__":
    # Change stdout encoding to UTF-8 to handle non-Latin scripts
    if sys.stdout.encoding != 'utf-8':
        # Force UTF-8 output regardless of system encoding
        sys.stdout.reconfigure(encoding='utf-8')
    
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Translate text using NLLB-200 model')
    parser.add_argument('--text', required=True, help='Text to translate (or base64 encoded text)')
    parser.add_argument('--target', required=True, help='Target language')
    parser.add_argument('--source', help='Source language (optional)')
    parser.add_argument('--base64', action='store_true', help='Indicates that text is base64 encoded')
    parser.add_argument('--output-file', help='Write translation to file instead of stdout (solves encoding issues)')
    
    args = parser.parse_args()
    
    try:
        # Decode base64 if needed
        if args.base64:
            try:
                decoded_text = base64.b64decode(args.text).decode('utf-8')
                print(f"Successfully decoded base64 text (length: {len(decoded_text)})", file=sys.stderr)
            except Exception as e:
                print(f"Error decoding base64: {e}", file=sys.stderr)
                print("ERROR: Failed to decode base64 text")
                sys.exit(1)
            text_to_translate = decoded_text
        else:
            text_to_translate = args.text
        
        # Translate the text
        translated_text = translate_text(text_to_translate, args.target, args.source)
        
        # Make sure we have output
        if not translated_text:
            print("WARNING: Empty translation result", file=sys.stderr)
            translated_text = "[Empty translation result]"
        
        # Print the translated text either to file or stdout with proper encoding
        if args.output_file:
            # Write to file (safer for non-Latin scripts)
            with open(args.output_file, 'w', encoding='utf-8') as f:
                f.write(translated_text)
            print(f"Translation written to {args.output_file}", file=sys.stderr)
        else:
            # Print to stdout with UTF-8 encoding
            try:
                # Try direct print with proper encoding
                print(translated_text)
            except UnicodeEncodeError:
                # If that fails, encode to UTF-8 bytes and decode to ASCII with escapes
                escaped_text = translated_text.encode('utf-8').decode('ascii', errors='backslashreplace')
                print(escaped_text)
                print("WARNING: Translation contains characters that cannot be displayed in console.", file=sys.stderr)
                print("Consider using --output-file option for better results.", file=sys.stderr)
    except Exception as e:
        print(f"Unexpected error in main: {e}", file=sys.stderr)
        # Make sure to output something to stdout for the API to capture
        print(f"ERROR: {e}")
        sys.exit(1)

# ...existing code...