import pathlib
import sys
import subprocess

from dotenv import load_dotenv

load_dotenv(pathlib.Path(__file__).resolve().parent / ".env")

if sys.platform == "win32":
    from app.win_startup import patch_platform_wmi

    patch_platform_wmi()

import uvicorn


def _is_project_venv() -> bool:
    venv_path = pathlib.Path(sys.prefix).resolve()
    return venv_path.name.lower() == ".venv"


def _get_project_venv_python() -> pathlib.Path | None:
    run_file_dir = pathlib.Path(__file__).resolve().parent
    venv_python = run_file_dir / ".venv" / "Scripts" / "python.exe"
    if venv_python.exists():
        return venv_python
    return None


def _reexec_with_project_venv() -> None:
    venv_python = _get_project_venv_python()
    if venv_python is None:
        print("Error: project virtual environment not found at Backend/.venv.")
        print('Run: python -m venv .venv && ".venv/Scripts/python.exe" -m pip install -r requirements.txt')
        sys.exit(1)

    run_file_path = pathlib.Path(__file__).resolve()
    result = subprocess.run(
        [str(venv_python), str(run_file_path)],
        cwd=str(run_file_path.parent),
    )
    sys.exit(result.returncode)


def main() -> None:
    if not _is_project_venv():
        _reexec_with_project_venv()

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=9000,
        reload=True,
        log_level="info",
        access_log=False,
        timeout_keep_alive=0,
    )


if __name__ == "__main__":
    main()
