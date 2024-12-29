# print_code.py (unchanged, just a helper script)
import os

def read_files_same_directory(root_dir, output_file, file_extensions):
    with open(output_file, 'w') as outfile:
        for file in os.listdir(root_dir):
            if any(file.endswith(ext) for ext in file_extensions) and 'venv' not in root_dir:
                file_path = os.path.join(root_dir, file)
                with open(file_path, 'r', encoding='utf-8') as infile:
                    outfile.write(f"\n# Content from: {file_path}\n\n")
                    outfile.write(infile.read())
                    outfile.write("\n\n")

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__)) 
    output_file = 'combined_code.txt'
    file_extensions = ['.py', '.html', '.js', '.css']
    read_files_same_directory(script_dir, output_file, file_extensions)
    print(f"All specified files in the same directory have been combined into {output_file}")
