"""Validate the actual catalogue and a runtime result, using local schema references."""
from pathlib import Path
import json
from jsonschema import Draft202012Validator, RefResolver
root=Path(__file__).resolve().parents[2]
app=root/'app'
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def validate(schema,instance):
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema,resolver=RefResolver(base_uri=app.as_uri()+'/',referrer=schema)).validate(instance)
validate(load(app/'master-library.schema.json'),load(app/'master-library.v2.json'))
validate(load(app/'interface.schema.json'),load(root/'tests/output/architecture-result.json'))
print('Master Library v2, five-object schemas and actual runtime result validated')
