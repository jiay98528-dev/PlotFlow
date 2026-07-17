@tool
class_name PlotFlowConditionEval
extends RefCounted

## Evaluates Fablevia conditions against a VariableStore.
##
## Supported operators:
##   eq   — equal
##   neq  — not equal
##   gt   — greater than
##   gte  — greater than or equal
##   lt   — less than
##   lte  — less than or equal
##   has  — string contains
##   in   — value is in a comma-separated list
##
## Condition syntax (as produced by the PlotFlow editor):
##   [condition: variable operator value]
## Example:
##   [condition: health lt 50]


## Evaluate an exported condition value without degrading its AST. Supports:
## - 0.1 comparison nodes: { variable, operator, value }
## - 0.2 comparison nodes: { left, operator, right }
## - legacy string arrays used by the earliest Godot runtime.
static func evaluate_condition(condition: Variant, store: PlotFlowVariableStore) -> bool:
	if condition == null:
		return true
	if condition is Dictionary:
		var ast: Variant = condition.get("ast", condition)
		if ast is Dictionary:
			return evaluate_ast(ast, store)
		var expression := str(condition.get("expression", ""))
		return false if expression.is_empty() else evaluate(expression, store)
	if condition is Array:
		for entry in condition:
			if not evaluate_condition(entry, store):
				return false
		return true
	return evaluate(str(condition), store)


## Recursively evaluate an exported condition AST.
static func evaluate_ast(ast: Variant, store: PlotFlowVariableStore) -> bool:
	if not (ast is Dictionary):
		return false
	if not _ast_variables_accessible(ast, store):
		return false
	return _evaluate_ast_unchecked(ast, store)


static func _evaluate_ast_unchecked(ast: Variant, store: PlotFlowVariableStore) -> bool:
	if not (ast is Dictionary):
		return false
	match str(ast.get("type", "")):
		"logical_and":
			return _evaluate_ast_unchecked(ast.get("left"), store) and _evaluate_ast_unchecked(ast.get("right"), store)
		"logical_or":
			return _evaluate_ast_unchecked(ast.get("left"), store) or _evaluate_ast_unchecked(ast.get("right"), store)
		"logical_not":
			return not _evaluate_ast_unchecked(ast.get("operand"), store)
		"comparison":
			return _evaluate_comparison(ast, store)
		_:
			push_warning("Fablevia ConditionEval: unknown AST node type '%s'" % str(ast.get("type", "")))
			return false


static func _ast_variables_accessible(ast: Variant, store: PlotFlowVariableStore) -> bool:
	if not (ast is Dictionary):
		return false
	match str(ast.get("type", "")):
		"logical_and", "logical_or":
			return (
				ast.get("left") is Dictionary
				and ast.get("right") is Dictionary
				and _ast_variables_accessible(ast.get("left"), store)
				and _ast_variables_accessible(ast.get("right"), store)
			)
		"logical_not":
			return ast.get("operand") is Dictionary and _ast_variables_accessible(ast.get("operand"), store)
		"comparison":
			if ast.has("left") or ast.has("right"):
				return _operand_variable_accessible(ast.get("left"), store) and _operand_variable_accessible(ast.get("right"), store)
			return bool(_resolve_variable(str(ast.get("variable", "")), store).get("ok", false))
		_:
			return true


static func _operand_variable_accessible(operand: Variant, store: PlotFlowVariableStore) -> bool:
	if not (operand is Dictionary):
		return false
	if str(operand.get("type", "")) == "literal":
		return operand.has("value")
	if str(operand.get("type", "")) == "variable":
		return bool(_resolve_variable(str(operand.get("name", "")), store).get("ok", false))
	return false


## Evaluate a single condition string.
## Returns true if the condition passes.
static func evaluate(condition: String, store: PlotFlowVariableStore) -> bool:
	condition = condition.strip_edges()

	# Strip optional [condition: ...] wrapper.
	if condition.begins_with("[condition:") and condition.ends_with("]"):
		condition = condition.substr(11, condition.length() - 12).strip_edges()
	elif condition.begins_with("[") and condition.ends_with("]"):
		condition = condition.substr(1, condition.length() - 2).strip_edges()

	# Parse: variable operator value
	var parts := _split_condition(condition)
	if parts.size() < 3:
		push_warning("Fablevia ConditionEval: malformed condition '%s'" % condition)
		return false

	var var_name := parts[0].strip_edges()
	if var_name.begins_with("$"):
		var_name = var_name.substr(1)
	var op := parts[1].strip_edges()
	var raw_value := parts[2].strip_edges()

	# Resolve variable value from the store.
	var actual := store.get_var(var_name)
	if actual == null:
		# If the variable is missing, the condition fails unless we treat
		# it as a literal.  Here we fail closed.
		return false

	# Parse expected value.
	var expected := _parse_value(raw_value)

	match op:
		"eq", "==", "=":
			return actual == expected
		"neq", "!=":
			return actual != expected
		"gt", ">":
			return float(actual) > float(expected)
		"gte", ">=":
			return float(actual) >= float(expected)
		"lt", "<":
			return float(actual) < float(expected)
		"lte", "<=":
			return float(actual) <= float(expected)
		"has":
			return str(actual).find(str(expected)) >= 0
		"in":
			var items := str(expected).split(",")
			for item in items:
				if str(actual).strip_edges() == item.strip_edges():
					return true
			return false
		_:
			push_warning("Fablevia ConditionEval: unknown operator '%s'" % op)
			return false


## Evaluate multiple conditions joined by [code]and[/code] / [code]or[/code].
## Each element in [code]conditions[/code] is a raw condition string.
## [code]join[/code] should be "and" or "or" (default "and").
static func evaluate_many(conditions: Array[String], store: PlotFlowVariableStore, join: String = "and") -> bool:
	if conditions.is_empty():
		return true

	var results: Array[bool]
	for c in conditions:
		results.append(evaluate(c, store))

	match join:
		"or":
			return results.any(func(r): return r)
		_:
			return results.all(func(r): return r)


## Split "var op value" into three tokens, respecting quotes.
static func _split_condition(text: String) -> PackedStringArray:
	var tokens: PackedStringArray
	var current := ""
	var in_quote := false

	for ch in text:
		if ch == "\"":
			in_quote = not in_quote
			current += ch
		elif ch == " " and not in_quote:
			if not current.is_empty():
				tokens.append(current)
				current = ""
		else:
			current += ch

	if not current.is_empty():
		tokens.append(current)

	return tokens


static func _evaluate_comparison(comparison: Dictionary, store: PlotFlowVariableStore) -> bool:
	var left: Dictionary = {}
	var right: Dictionary = {}
	if comparison.has("left") or comparison.has("right"):
		left = _resolve_operand(comparison.get("left"), store)
		right = _resolve_operand(comparison.get("right"), store)
	else:
		# PlotFlow 0.1 shape.
		left = _resolve_variable(str(comparison.get("variable", "")), store)
		right = {"ok": comparison.has("value"), "value": comparison.get("value")}
	if not bool(left.get("ok", false)) or not bool(right.get("ok", false)):
		return false
	return _compare_values(left.get("value"), right.get("value"), str(comparison.get("operator", "")))


static func _resolve_operand(operand: Variant, store: PlotFlowVariableStore) -> Dictionary:
	if not (operand is Dictionary):
		return {"ok": false}
	match str(operand.get("type", "")):
		"literal":
			return {"ok": operand.has("value"), "value": operand.get("value")}
		"variable":
			return _resolve_variable(str(operand.get("name", "")), store)
		_:
			return {"ok": false}


static func _resolve_variable(path: String, store: PlotFlowVariableStore) -> Dictionary:
	if path.begins_with("$"):
		path = path.substr(1)
	var parts := path.split(".")
	if parts.is_empty() or str(parts[0]).is_empty():
		return {"ok": false}
	var current: Variant = store.get_var(str(parts[0]))
	if current == null:
		return {"ok": false}
	for index in range(1, parts.size()):
		if not (current is Dictionary) or not current.has(parts[index]):
			return {"ok": false}
		current = current[parts[index]]
	return {"ok": true, "value": current}


static func _compare_values(left: Variant, right: Variant, operator: String) -> bool:
	match operator:
		"eq", "==", "=":
			return left == right
		"neq", "!=":
			return left != right
		"gt", ">":
			return _ordered_compare(left, right) > 0
		"gte", ">=":
			return _ordered_compare(left, right) >= 0
		"lt", "<":
			return _ordered_compare(left, right) < 0
		"lte", "<=":
			return _ordered_compare(left, right) <= 0
		"has":
			return str(left).find(str(right)) >= 0
		"in":
			return right is Array and left in right
		_:
			push_warning("Fablevia ConditionEval: unknown comparison operator '%s'" % operator)
			return false


static func _ordered_compare(left: Variant, right: Variant) -> int:
	var left_type := typeof(left)
	var right_type := typeof(right)
	if left_type in [TYPE_INT, TYPE_FLOAT] and right_type in [TYPE_INT, TYPE_FLOAT]:
		var left_number := float(left)
		var right_number := float(right)
		return -1 if left_number < right_number else (1 if left_number > right_number else 0)
	var left_text := str(left)
	var right_text := str(right)
	return -1 if left_text < right_text else (1 if left_text > right_text else 0)


## Parse a string value into bool / int / float / string.
static func _parse_value(text: String) -> Variant:
	if text.is_empty():
		return ""

	# Strip surrounding quotes.
	var raw := text
	if raw.begins_with("\"") and raw.ends_with("\""):
		return raw.substr(1, raw.length() - 2)

	# Boolean.
	if raw.to_lower() in ["true", "yes"]:
		return true
	if raw.to_lower() in ["false", "no"]:
		return false

	# Integer.
	if raw.is_valid_int():
		return int(raw)

	# Float.
	if raw.is_valid_float():
		return float(raw)

	# Fallback: string.
	return raw
