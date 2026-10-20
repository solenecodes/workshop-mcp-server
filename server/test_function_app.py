import json
import unittest
from unittest.mock import patch

import function_app as workshop


class ValidationTests(unittest.IsolatedAsyncioTestCase):
    def test_blob_names_are_scoped_to_the_workshop_team(self):
        self.assertEqual(workshop.blob_name("team-07", "hello"), "team-07/hello.json")

    def test_identifiers_cannot_escape_the_container_prefix(self):
        for value in ("", "../secret", "team/a", "a" * 49, "UPPER", "a?x"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                workshop.validate_name(value)

    async def test_invalid_content_is_rejected_before_storage(self):
        with patch.object(workshop, "storage") as storage:
            for content in ("", "x" * 4001):
                with self.assertRaises(ValueError):
                    await workshop.save_snippet(json.dumps({"arguments": {
                        "team_id": "team-07", "snippetname": "hello", "snippet": content,
                    }}))
            storage.assert_not_called()

    def test_all_primitives_are_registered(self):
        bindings = [binding for function in workshop.app.get_functions() for binding in function.get_bindings()]
        kinds = [binding.type for binding in bindings]
        self.assertEqual(kinds.count("mcpToolTrigger"), 5)
        self.assertEqual(kinds.count("mcpResourceTrigger"), 2)
        self.assertEqual(kinds.count("mcpPromptTrigger"), 1)


if __name__ == "__main__":
    unittest.main()
