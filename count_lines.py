import os

EXTENSIONS = {'.py', '.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json'}
EXCLUDES_DIRS = {'node_modules', '.next', 'venv', '__pycache__', 'alembic', '.git', 'out'}

def count_lines(directory):
    total = 0
    file_counts = {}
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in EXCLUDES_DIRS]
        for file in files:
            ext = os.path.splitext(file)[1]
            if ext in EXTENSIONS:
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                        lines = sum(1 for _ in f)
                        total += lines
                        file_counts[path] = lines
                except Exception as e:
                    pass
    return total, file_counts

b_lines, b_files = count_lines(r'c:\Users\xamytik\urban-blind\backend')
f_lines, f_files = count_lines(r'c:\Users\xamytik\urban-blind\frontend')

print("="*40)
print(f"Бэкенд (Python, SQL, ...): {b_lines} строк ({len(b_files)} файлов)")
print(f"Фронтенд (React, TS, ...): {f_lines} строк ({len(f_files)} файлов)")
print("\n" + "="*40)
print(f"ИТОГО В ПРОЕКТЕ: {b_lines + f_lines} строк кода")
print("="*40)
