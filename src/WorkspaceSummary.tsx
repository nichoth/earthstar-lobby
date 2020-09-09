import React, { useContext, useState } from "react";
import { createFragmentContainer, RelayProp } from "react-relay";
import graphql from "babel-plugin-relay/macro";
import { css } from "styled-components/macro";

import MaxWidth from "./MaxWidth";
import NavButton from "./NavButton";
import Button from "./Button";
import AuthorIdenticon from "./AuthorIdenticon";
import ContextualPanel from "./ContextualPanel";
import { LobbyContext } from "./util/lobby-context";
import { useWindupAlert, usePubs, useUnpersistWorkspace } from "./util/hooks";
import TextInput from "./TextInput";

import SyncMutation from "./mutations/SyncMutation";
import RemoveWorkspaceMutation from "./mutations/RemoveWorkspaceMutation";

import { WorkspaceSummary_workspace } from "./__generated__/WorkspaceSummary_workspace.graphql";

const PubEditor = ({ workspace }: { workspace: string }) => {
  const [pubs, setPubs] = usePubs();
  const [newPub, setNewPub] = useState("");
  const remove = (pubToRemove: string) => {
    setPubs((prev) => {
      const currentPubs = prev[workspace] || [];

      return {
        ...prev,
        [workspace]: (currentPubs || []).filter((pub) => pub !== pubToRemove),
      };
    });
  };
  const add = (pubToAdd: string) => {
    setNewPub("");
    setPubs((prev) => {
      const currentPubs = prev[workspace] || [];

      return {
        ...prev,
        [workspace]: Array.from(new Set([...(currentPubs || []), pubToAdd])),
      };
    });
  };

  return (
    <>
      {pubs[workspace]
        ? pubs[workspace].map((pub) => {
            return (
              <li
                css={css`
                  display: flex;
                  justify-content: flex-end;
                  align-items: baseline;
                  margin-bottom: 0.5em;
                  color: ${(props) => props.theme.colours.fgHint};
                `}
              >
                {pub}
                <Button
                  css={css`
                    margin-left: 0.4em;
                  `}
                  onClick={() => {
                    remove(pub);
                  }}
                >
                  {"Remove"}
                </Button>
              </li>
            );
          })
        : null}
      <div
        css={css`
          margin-top: 0.8em;
        `}
      >
        <TextInput
          placeholder={"https://my.pub"}
          value={newPub}
          onChange={(e) => setNewPub(e.target.value)}
        />
        <Button
          onClick={() => {
            add(newPub);
          }}
        >
          {"Add another pub"}
        </Button>
      </div>
    </>
  );
};

type WorkspaceSummaryProps = {
  relay: RelayProp;
  workspace: WorkspaceSummary_workspace;
};

type PanelState = "options" | "pubs" | "closed";

const WorkspaceSummary: React.FC<WorkspaceSummaryProps> = ({
  workspace,
  relay,
}) => {
  const { appStateDispatch } = useContext(LobbyContext);

  const firstThreePosts = workspace.documents.slice(0, 3);

  const [
    workspaceNameNode,
    setWorkspaceNameNode,
  ] = useState<HTMLElement | null>(null);

  const [panelState, setPanelState] = useState<PanelState>("closed");

  const [pubs] = usePubs();

  const [status, setStatus] = useWindupAlert(
    pubs[workspace.address] === undefined ||
      pubs[workspace.address].length === 0
      ? " has no known pubs!"
      : ` ${workspace.population} members`
  );

  const unpersist = useUnpersistWorkspace();

  return (
    <>
      {panelState !== "closed" ? (
        <ContextualPanel
          accentColour={"alpha"}
          pointsToNode={workspaceNameNode}
        >
          <div
            css={css`
              text-align: right;
            `}
          >
            {panelState === "options" ? (
              <>
                {pubs[workspace.address] ? (
                  <>
                    <Button
                      onClick={() => {
                        setPanelState("closed");
                        setStatus("is syncing...");
                        SyncMutation.commit(
                          relay.environment,
                          {
                            workspace: workspace.address,
                            pubUrls: pubs[workspace.address] || [],
                          },
                          (res) => {
                            if (res.syncWithPubs.__typename !== "SyncReport") {
                              return;
                            }

                            setStatus("was synced");
                          }
                        );
                      }}
                    >
                      {"Sync"}
                    </Button>
                    {" or "}
                  </>
                ) : null}
                <Button onClick={() => setPanelState("pubs")}>
                  {"Edit Pubs"}
                </Button>
                {" or "}
                <Button
                  onClick={() => {
                    RemoveWorkspaceMutation.commit(
                      relay.environment,
                      {
                        workspaceAddress: workspace.address,
                      },
                      (res) => {
                        if (
                          res.removeWorkspace.__typename ===
                          "WorkspaceRemovedResult"
                        ) {
                          unpersist(res.removeWorkspace.address);
                        }
                        setPanelState("closed");
                      }
                    );
                  }}
                >
                  {"Remove"}
                </Button>
              </>
            ) : null}
            {panelState === "pubs" ? (
              <PubEditor workspace={workspace.address} />
            ) : null}
          </div>
        </ContextualPanel>
      ) : null}
      <MaxWidth>
        <div
          css={css`
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-top: 0.7em;
          `}
        >
          <div>
            <NavButton
              onClick={() => {
                appStateDispatch({
                  type: "OPEN_WORKSPACE",
                  address: workspace.address,
                });
              }}
              accent={"alpha"}
            >
              <b>{workspace.name}</b>
            </NavButton>
            <span
              css={css`
                color: ${(props) => props.theme.colours.fgHint};
              `}
            >
              {` ${status}`}
            </span>
          </div>
          <NavButton
            accent={"alpha"}
            css={css`
              margin-left: 8px;
            `}
            onClick={() => {
              setPanelState((prev) =>
                prev !== "closed" ? "closed" : "options"
              );
            }}
            ref={(inst) => setWorkspaceNameNode(inst)}
          >
            {"options"}
          </NavButton>
        </div>
        <div
          css={css`
            margin-top: 0.4em;
          `}
        >
          {firstThreePosts.map((post) => {
            if (post.__typename === "ES4Document") {
              return (
                <div
                  key={post.id}
                  css={css`
                    text-overflow: ellipsis;
                    overflow: hidden;
                    white-space: nowrap;
                    line-height: 1.5;
                  `}
                >
                  <span
                    css={css`
                      color: ${(props) => props.theme.colours.fgHint};
                    `}
                  >
                    {post.author.shortName}{" "}
                    <AuthorIdenticon address={post.author.address} />{" "}
                    {post.content}
                  </span>
                </div>
              );
            }
            return null;
          })}
        </div>
      </MaxWidth>
    </>
  );
};

export default createFragmentContainer(WorkspaceSummary, {
  workspace: graphql`
    fragment WorkspaceSummary_workspace on Workspace {
      name
      address
      population
      documents(sortedBy: NEWEST, pathPrefixes: ["/lobby"]) {
        __typename
        ... on ES4Document {
          id
          content
          author {
            shortName
            address
          }
        }
      }
    }
  `,
});