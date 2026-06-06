"""Загрузка и валидация пакетов моделей с диска."""

from pathlib import Path
from datetime import datetime
import joblib
from typing import Optional, Tuple
from contextlib import contextmanager


def detect_framework(model) -> str:
    """Автоматически определяет фреймворк модели."""
    model_type = type(model).__name__
    model_module = type(model).__module__

    if 'pytorch_tabnet' in model_module.lower() or 'tabnet' in model_type.lower():
        return 'tabnet'
    if 'catboost' in model_module.lower() or model_type.startswith('CatBoost'):
        return 'catboost'
    if 'sklearn' in model_module.lower():
        return 'sklearn'
    if 'xgboost' in model_module.lower() or model_type.startswith('XGB'):
        return 'xgboost'
    if 'lightgbm' in model_module.lower() or model_type.startswith('LGBM'):
        return 'lightgbm'

    return 'unknown'


def _is_tabnet_file(file_path: Path) -> bool:
    """
    Определяет, является ли файл TabNet-пакетом БЕЗ его загрузки.

    Используем быстрое сканирование байт файла — ищем сигнатуру
    'pytorch_tabnet' или 'TabNetClassifier' в pickle-потоке.
    Это безопасно и не требует десериализации.

    Альтернатива: соглашение об именовании файлов (model_v5_tabnet.pkl).
    """
    try:
        # Читаем первые 8KB — сигнатура класса всегда в начале pickle
        with open(file_path, 'rb') as f:
            header = f.read(8192)

        signatures = [b'pytorch_tabnet', b'TabNetClassifier', b'tabnet']
        return any(sig in header for sig in signatures)

    except Exception:
        return False


@contextmanager
def _torch_cpu_patch():
    """
    Контекстный менеджер: патчит torch.load на CPU только внутри блока.

    Использование:
        with _torch_cpu_patch():
            package = joblib.load(tabnet_file)
    
    Гарантии:
    - Патч активен ТОЛЬКО внутри блока with
    - Восстановление происходит даже при исключении (finally)
    - НЕ влияет на загрузку других моделей снаружи блока
    """
    try:
        import torch
    except ImportError:
        # torch не установлен — патч не нужен, просто выполняем блок
        yield
        return

    original_torch_load = torch.load

    def _cpu_torch_load(f, map_location=None, **kwargs):
        # Принудительно CPU, игнорируем переданный map_location
        return original_torch_load(f, map_location=torch.device('cpu'), **kwargs)

    torch.load = _cpu_torch_load
    print("  🔧 torch.load patched → CPU")

    try:
        yield
    finally:
        torch.load = original_torch_load
        print("  🔄 torch.load restored")


def _move_tabnet_to_cpu(package: dict) -> None:
    """
    Второй уровень защиты: явный перенос весов TabNet на CPU.

    Вызывается после joblib.load как дополнительная гарантия.
    ИЗОЛИРОВАНО: только для tabnet-пакетов.
    """
    try:
        import torch
    except ImportError:
        return

    def _move_one(model, label: str) -> None:
        try:
            model.device_name = 'cpu'
            model.device = torch.device('cpu')

            if hasattr(model, 'network') and model.network is not None:
                model.network = model.network.cpu()
                model.network.eval()

            print(f"    ✓ CPU move OK: {label}")
        except Exception as e:
            print(f"    ⚠️ CPU move warning [{label}]: {e}")

    for group_key in ('models_ik', 'models_offpump'):
        for name, model in package.get(group_key, {}).items():
            _move_one(model, f"{group_key}['{name}']")

    if 'model' in package:
        _move_one(package['model'], 'single model')


def validate_model_package(package: dict) -> bool:
    """Валидирует структуру пакета модели."""
    if not isinstance(package, dict):
        print("  ❌ Invalid package format")
        return False

    if 'feature_names' not in package:
        print("  ❌ No 'feature_names' in package")
        return False

    has_single_model = 'model' in package
    has_ensemble = 'models_ik' in package and 'models_offpump' in package

    if not (has_single_model or has_ensemble):
        print("  ❌ Package must contain 'model' or ('models_ik' + 'models_offpump')")
        return False

    return True


def load_model_from_file(file_path: Path) -> Tuple[Optional[str], Optional[dict]]:
    """
    Загружает пакет модели из файла.

    Ключевая логика изоляции:
    - Сначала проверяем байты файла на сигнатуру TabNet (_is_tabnet_file)
    - Только если это TabNet → активируем CPU-патч torch.load
    - Для всех остальных моделей torch.load НЕ трогаем совсем
    """
    version = file_path.stem.replace("model_", "")

    try:
        print(f"📦 Loading model {version}...")

        # ── Предварительная проверка: TabNet или нет? ─────────────────────────
        # Делаем ДО joblib.load, читая только заголовок файла
        is_tabnet = _is_tabnet_file(file_path)

        if is_tabnet:
            print(f"  🧠 TabNet signature detected in file — CPU patch will be applied")

        # ── Загрузка: с патчем для TabNet, без патча для всех остальных ───────
        if is_tabnet:
            with _torch_cpu_patch():
                package = joblib.load(file_path)
        else:
            # Для CatBoost / sklearn / XGBoost / LightGBM — НИКАКОГО патча
            package = joblib.load(file_path)

        # ── Обратная совместимость ключей ────────────────────────────────────
        if 'feature_names' not in package and 'features_list' in package:
            package['feature_names'] = package['features_list']

        if 'categorical_features' not in package and 'categorical_cols' in package:
            package['categorical_features'] = package['categorical_cols']

        if not validate_model_package(package):
            return None, None

        package['version'] = version

        # ── Определяем фреймворк ──────────────────────────────────────────────
        if 'framework' not in package:
            if 'models_ik' in package:
                first_model = next(iter(package['models_ik'].values()), None)
                package['framework'] = detect_framework(first_model) if first_model else 'unknown'
            elif 'model' in package:
                package['framework'] = detect_framework(package['model'])
            else:
                package['framework'] = 'unknown'

        package['is_ensemble'] = 'models_ik' in package

        # ── Уровень 2 CPU-патча: только для подтверждённых TabNet-пакетов ─────
        if package.get('framework') == 'tabnet':
            print(f"  🧠 Applying level-2 CPU patch (weight transfer)...")
            _move_tabnet_to_cpu(package)
            print(f"  ✅ TabNet ready for CPU inference")
        else:
            # Явное подтверждение что для других моделей ничего не делаем
            print(f"  ✅ Non-TabNet model ({package['framework']}) — no CPU patch needed")

        # ── Runtime-метаданные ────────────────────────────────────────────────
        package['_loaded_at'] = datetime.now().isoformat()
        package['_file_path'] = str(file_path)
        package['_file_size_mb'] = round(file_path.stat().st_size / 1024 / 1024, 2)

        print(
            f"  ✅ Loaded: {len(package['feature_names'])} features | "
            f"framework={package['framework']} | "
            f"ensemble={package['is_ensemble']}"
        )

        if 'demo_data' in package:
            print(f"  🎯 Demo data attached")

        return version, package

    except Exception as e:
        print(f"  ❌ Error loading {version}: {str(e)}")
        import traceback
        traceback.print_exc()
        return None, None