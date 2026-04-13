import click
from topo.auth import is_authenticated, login_command
from topo.session import start_session


@click.group(invoke_without_command=True)
@click.option('--no-browser', is_flag=True, default=False, help='Do not open the graph in the browser.')
@click.pass_context
def cli(ctx: click.Context, no_browser: bool) -> None:
    """Topo — graph layer on top of Claude.

    Run `topo` to start an interactive session.
    Run `topo login` to authenticate first.
    """
    if ctx.invoked_subcommand is None:
        # No subcommand — start an interactive session
        if not is_authenticated():
            click.echo("Not logged in. Run `topo login` first.")
            raise SystemExit(1)
        start_session(no_browser=no_browser)


@cli.command()
def login() -> None:
    """Authenticate with Topognosis."""
    login_command()
