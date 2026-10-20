import asyncio
import json
import uuid

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client


async def main() -> None:
    team = f"probe-{uuid.uuid4().hex[:12]}"
    args = {"team_id": team, "snippetname": "hello"}
    async with streamablehttp_client("http://127.0.0.1:7071/runtime/webhooks/mcp") as (read, write, _):
        async with ClientSession(read, write) as client:
            await client.initialize()
            tools = await client.list_tools()
            assert {"get_snippet", "save_snippet", "list_snippets", "delete_snippet", "generate_qr_code"} <= {tool.name for tool in tools.tools}
            saved = await client.call_tool("save_snippet", {**args, "snippet": "print('Hello workshop')"})
            assert not saved.isError, saved
            try:
                fetched = await client.call_tool("get_snippet", args)
                assert not fetched.isError and "Hello workshop" in str(fetched.content), fetched
                listing = await client.call_tool("list_snippets", {"team_id": team})
                assert not listing.isError and "hello" in str(listing.content), listing
                image = await client.call_tool("generate_qr_code", args)
                assert not image.isError and any(part.type == "image" for part in image.content), image
                resources = await client.list_resources()
                assert "info://server" in {str(resource.uri) for resource in resources.resources}
                templates = await client.list_resource_templates()
                assert any("snippet://" in template.uriTemplate for template in templates.resourceTemplates)
                resource = await client.read_resource(f"snippet://{team}/hello")
                assert "Hello workshop" in str(resource.contents), resource
                prompts = await client.list_prompts()
                assert "review_snippet" in {prompt.name for prompt in prompts.prompts}
                prompt = await client.get_prompt("review_snippet", args)
                assert "Hello workshop" in str(prompt.messages), prompt
                invalid = await client.call_tool("get_snippet", {**args, "snippetname": "../escape"})
                assert invalid.isError, invalid
                print(json.dumps({"tools": len(tools.tools), "resource": "read", "prompt": "retrieved", "image": "returned", "invalid_input": "rejected"}))
            finally:
                deleted = await client.call_tool("delete_snippet", args)
                assert not deleted.isError, deleted
                print("Temporary probe snippet deleted.")


if __name__ == "__main__":
    asyncio.run(main())
