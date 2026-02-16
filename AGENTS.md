<!-- discode:file-instructions -->
## Discord File Attachments

### Receiving files from Discord

When a message from Discord contains file attachments, the files are
automatically downloaded and referenced with markers in the following format:

```
[file:/absolute/path/to/file.pdf]
```

**When you see `[file:...]` markers, you MUST:**
1. Use your file reading tool (e.g. `Read`, `view`, `cat`) to open the
   file at the given absolute path.
2. Analyze or describe the file content as requested by the user.
3. If multiple files are attached, read and process all of them.

The files are stored under the project's `/home/mud/repo/blog/.discode/files/` directory.
Supported formats: PNG, JPEG, GIF, WebP, PDF, DOCX, PPTX, XLSX, CSV, JSON, TXT.

### The `/home/mud/repo/blog/.discode/files/` directory — ALWAYS CHECK HERE FIRST

This directory is the **shared file workspace** for both receiving and sending
files through Discord.

**IMPORTANT:** When the user asks you to send, show, or share any file, image,
document, or visual content, you **MUST list the files in `/home/mud/repo/blog/.discode/files/` first**
before doing anything else (including web searches). The file the user is referring
to is almost certainly already in this directory. Only search externally if the
requested file does not exist here.

### Sending files to Discord

When you generate or create a file (e.g. charts, diagrams, screenshots,
rendered output, PDFs, documents), **always save it to `/home/mud/repo/blog/.discode/files/`**. Any
file whose absolute path appears in your response text is automatically sent
as a Discord file attachment.

Supported formats: PNG, JPEG, GIF, WebP, SVG, BMP, PDF, DOCX, PPTX, XLSX, CSV, JSON, TXT.

**To send a generated file to Discord:**
1. Save the file to `/home/mud/repo/blog/.discode/files/`.
2. Mention the absolute file path in your response text.
   For example: "Here is the chart I generated: `/home/mud/repo/blog/.discode/files/chart.png`"
3. The system will automatically extract the path and attach the file
   to the Discord message.

**Tips:**
- Use descriptive filenames (e.g. `architecture-diagram.png`, not `output.png`).
- Always use absolute paths so the system can locate and send the file.
- You can send multiple files by mentioning multiple paths in your response.

### Python dependencies for document processing

Processing PDF, DOCX, PPTX, XLSX files may require Python libraries (e.g.
`pymupdf`, `python-pptx`, `openpyxl`, `python-docx`). When you need a
library that is not installed, **always use a venv**:

```bash
python3 -m venv /home/mud/repo/blog/.discode/files/.venv
source /home/mud/repo/blog/.discode/files/.venv/bin/activate
pip install <package>
```

Reuse the existing venv if `/home/mud/repo/blog/.discode/files/.venv` already exists. Never install
packages globally with `pip install` outside of a venv.
