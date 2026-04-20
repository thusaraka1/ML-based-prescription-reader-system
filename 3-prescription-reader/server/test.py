"""Medical Prescription OCR Dataset"""

import json
import os

import datasets
from PIL import Image


_DESCRIPTION = """
Medical Prescription OCR Dataset - A collection of synthetic handwritten medical prescriptions
with structured annotations for training OCR models.
"""

_CITATION = """
@dataset{shrivastava2024medicalprescription,
  author = {Chinmay Shrivastava},
  title = {Medical Prescription OCR Dataset},
  year = {2024},
  publisher = {Hugging Face},
  url = {https://huggingface.co/datasets/chinmays18/medical-prescription-dataset}
}
"""


class MedicalPrescriptionDataset(datasets.GeneratorBasedBuilder):
    """Medical Prescription OCR Dataset"""

    VERSION = datasets.Version("1.0.0")

    def _info(self):
        return datasets.DatasetInfo(
            description=_DESCRIPTION,
            features=datasets.Features({
                "image": datasets.Image(),
                "ground_truth": datasets.Value("string"),
            }),
            citation=_CITATION,
        )

    def _split_generators(self, dl_manager):
        # The dataset files are already in the repository
        return [
            datasets.SplitGenerator(
                name=datasets.Split.TRAIN,
                gen_kwargs={
                    "images_path": "train/images",
                    "annotations_path": "train/annotations",
                },
            ),
            datasets.SplitGenerator(
                name=datasets.Split.VALIDATION,
                gen_kwargs={
                    "images_path": "val/images",
                    "annotations_path": "val/annotations",
                },
            ),
            datasets.SplitGenerator(
                name=datasets.Split.TEST,
                gen_kwargs={
                    "images_path": "test/images",
                    "annotations_path": "test/annotations",
                },
            ),
        ]

    def _generate_examples(self, images_path, annotations_path):
        # Get all image files
        image_files = sorted([f for f in os.listdir(images_path) if f.endswith('.png')])
        
        for idx, image_file in enumerate(image_files):
            # Get corresponding annotation file
            base_name = os.path.splitext(image_file)[0]
            annotation_file = f"{base_name}.json"
            
            # Read image
            image_path = os.path.join(images_path, image_file)
            
            # Read annotation
            annotation_path = os.path.join(annotations_path, annotation_file)
            with open(annotation_path, 'r') as f:
                annotation = json.load(f)
            
            yield idx, {
                "image": image_path,
                "ground_truth": annotation["ground_truth"],
            }
