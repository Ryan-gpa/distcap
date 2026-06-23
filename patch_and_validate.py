import zipfile
import re
import os
import sys
import tempfile
import shutil

def validate_and_patch(docx_path, is_template=False):
    if not os.path.exists(docx_path):
        print(f"Error: File {docx_path} does not exist.")
        sys.exit(1)
        
    temp_dir = tempfile.mkdtemp()
    try:
        # Unzip docx
        with zipfile.ZipFile(docx_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
            
        validation_errors = []
        highlight_cs_patched = 0
        
        # Traverse the unzipped folder
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                if file.endswith('.xml'):
                    file_path = os.path.join(root, file)
                    # We use utf-8 encoding and ignore decode errors to be safe with any binary markers
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    
                    # 1. Strip highlightCs elements (docx-js validation bug fix)
                    modified_content, count = re.subn(r'<w:highlightCs[^/]*/>', '', content)
                    if count > 0:
                        highlight_cs_patched += count
                        
                    # 2. Validation Checks (only for live proposals, not the template itself)
                    if not is_template:
                        # Only scan body content (word/document.xml) for yellow highlights
                        # Footers can have yellow accent blocks (false positive), so we exclude footer xml files
                        is_body = 'document.xml' in file
                        is_header_footer = 'header' in file or 'footer' in file
                        
                        # Check for highlights in document body
                        if is_body and '<w:highlight w:val="yellow"' in modified_content:
                            validation_errors.append(f"Yellow highlight found in document body ({file})")
                        
                        # Extract visible text runs to search for placeholders and guidance
                        # Visible text is wrapped in <w:t>...</w:t> tags
                        text_runs = re.findall(r'<w:t[^>]*>(.*?)</w:t>', modified_content)
                        for run in text_runs:
                            # Ignore header/footer bracket strings if they are expected, but there are none
                            if '[' in run:
                                validation_errors.append(f"Unfilled placeholder containing '[' found: '{run}' in ({file})")
                            if 'GUIDANCE —' in run:
                                validation_errors.append(f"Guidance callout string 'GUIDANCE —' found: '{run}' in ({file})")

                    # Write back modified content
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(modified_content)
                        
        if validation_errors:
            print("Validation Failed:")
            for err in validation_errors:
                print(f"  - {err}")
            sys.exit(1)
            
        # Re-zip docx
        out_fd, out_path = tempfile.mkstemp()
        os.close(out_fd)
        
        with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zip_out:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zip_out.write(file_path, arcname)
                    
        shutil.move(out_path, docx_path)
        print(f"Successfully validated, patched w:highlightCs ({highlight_cs_patched} times), and repacked {docx_path}")
        
    except Exception as e:
        print(f"Error during patching/validation: {str(e)}")
        sys.exit(1)
    finally:
        shutil.rmtree(temp_dir)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python patch_and_validate.py <path_to_docx> [--template]")
        sys.exit(1)
        
    path = sys.argv[1]
    is_temp = '--template' in sys.argv
    validate_and_patch(path, is_template=is_temp)
