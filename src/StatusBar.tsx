import React, { useState, useCallback, useEffect, useRef } from "react";
import { css } from "styled-components/macro";
import graphql from "babel-plugin-relay/macro";
import { createFragmentContainer, RelayProp } from "react-relay";
import { AuthorKeypair, generateAuthorKeypair, isErr } from "earthstar";
import { StatusBar_workspace } from "./__generated__/StatusBar_workspace.graphql";
import { getAuthorShortname, isKeypair } from "./util/handy";
import useInternetTime from "use-internet-time";
import NavButton from "./NavButton";
import Button from "./Button";
import { useDropzone } from "react-dropzone";
import { useDownload, usePrevious } from "./util/hooks";
import SyncMutation from "./mutations/SyncMutation";
import { PUB_URL } from "./constants";
import ContextualPanel from "./ContextualPanel";
import { WindupChildren } from "windups";
import MaxWidth from "./MaxWidth";
import SetMutation from "./mutations/SetMutation";
import TextInput from "./TextInput";
import AuthorIdenticon from "./AuthorIdenticon";

type StatusBarProps = {
  author: AuthorKeypair | null;
  setAuthor: (keypair: AuthorKeypair | null) => void;
  workspace: StatusBar_workspace;
  relay: RelayProp;
  setHeight: (height: number) => void;
  hasLocalWorkspaceChanges: boolean;
  setHasLocalWorkspaceChanges: (hasChanges: boolean) => void;
};

type Panel = "workspace" | "author" | "author-management" | "no-identity";

const StatusBar: React.FC<StatusBarProps> = ({
  workspace,
  author,
  setAuthor,
  relay,
  setHeight,
  setHasLocalWorkspaceChanges,
  hasLocalWorkspaceChanges,
}) => {
  const [openPanel, setOpenPanel] = useState<Panel | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tempMessage, setTempMessage] = useState<string | null>(null);

  const isAuthorDefined = author !== null;

  // Close the contextual panel if the author changes (i.e. signs out or in)
  useEffect(() => {
    setOpenPanel(null);
  }, [isAuthorDefined]);

  // What to do when a keypair is uploaded
  const onDrop = useCallback(
    (accepted, _rejected) => {
      if (accepted.length === 0) {
        return;
      }

      const fileToRead = accepted[0];

      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;

        if (typeof result !== "string") {
          alert("Please upload a keypair.json");
          return;
        }

        const maybeKeypair = JSON.parse(result);

        if (!isKeypair(maybeKeypair)) {
          alert("Please upload a valid keypair.");
          return;
        }

        setAuthor(maybeKeypair);
      };

      reader.readAsText(fileToRead);
    },
    [setAuthor]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: () => alert("Please drop a keypair.json here!"),
    accept: "application/json",
  });

  // Creates a fn to trigger a virtual download of the keypair
  const download = useDownload(JSON.stringify(author), "keypair.json");

  // State for display name
  const [newDisplayName, setNewDisplayName] = useState("");

  const setDisplayName = () => {
    if (!author) {
      return;
    }

    SetMutation.commit(
      relay.environment,
      {
        author,
        document: {
          content: newDisplayName,
          path: `/about/${author.address}/name`,
        },
        workspace: workspace.address,
      },
      () => {
        setHasLocalWorkspaceChanges(true);
      }
    );
  };

  // Using these to make the contextual panel's arrow point to the right place
  const workspaceNameRef = useRef(null);
  const authorRef = useRef(null);

  const prevOpenPanel = usePrevious(openPanel);

  // Here for a good sticky effect
  const measuredRef = useCallback(
    (node) => {
      if (node !== null && prevOpenPanel !== openPanel) {
        setHeight(node.getBoundingClientRect().height);
      }
    },
    [prevOpenPanel, openPanel, setHeight]
  );

  useEffect(() => {
    if (tempMessage) {
      const timeout = setTimeout(() => {
        setTempMessage(null);
      }, 3000);

      return () => {
        clearTimeout(timeout);
      };
    }
  }, [tempMessage]);

  return (
    <div
      css={css`
        position: sticky;
        z-index: 1;
        top: 0;
        background: ${(props) => props.theme.colours.bg};
        border-bottom: 1px solid ${(props) => props.theme.colours.bgHint};
        box-shadow: 2px 2px 4px 4px rgba(0, 0, 0, 0.04);
      `}
      ref={measuredRef}
    >
      {/* This is quite convoluted, I will tidy this up later */}
      {openPanel !== null ? (
        <ContextualPanel
          pointsToRef={openPanel === "workspace" ? workspaceNameRef : authorRef}
          accentColour={openPanel === "workspace" ? "alpha" : "beta"}
        >
          {openPanel === "workspace" ? (
            <>
              <Button
                onClick={() => {
                  setIsSyncing(true);
                  SyncMutation.commit(
                    relay.environment,
                    {
                      pubUrl: PUB_URL,
                      workspace: workspace.address,
                      format: "GRAPHQL",
                    },
                    (res) => {
                      console.log("Sync Complete ✅");
                      setHasLocalWorkspaceChanges(false);
                      setIsSyncing(false);

                      if (
                        res.syncWithPub.__typename !== "DetailedSyncSuccess"
                      ) {
                        return;
                      }

                      if (
                        res.syncWithPub.pulled.acceptedCount === 0 &&
                        res.syncWithPub.pushed.acceptedCount === 0
                      ) {
                        setTempMessage("No updates.");
                        return;
                      }

                      if (res.syncWithPub.pulled.acceptedCount === 0) {
                        setTempMessage(
                          `Pushed ${
                            res.syncWithPub.pushed.acceptedCount
                          } update${
                            res.syncWithPub.pushed.acceptedCount > 1 ? "s" : ""
                          }.`
                        );
                        return;
                      }

                      if (res.syncWithPub.pushed.acceptedCount === 0) {
                        setTempMessage(
                          `Pulled ${
                            res.syncWithPub.pulled.acceptedCount
                          } update${
                            res.syncWithPub.pulled.acceptedCount > 1 ? "s" : ""
                          }.`
                        );
                        return;
                      }

                      setTempMessage(
                        `Downloaded ${res.syncWithPub.pulled.acceptedCount}, uploaded ${res.syncWithPub.pushed.acceptedCount} posts.`
                      );
                    }
                  );
                }}
              >
                Sync this workspace
              </Button>
              {" or "}
              <Button disabled>View another one</Button>
            </>
          ) : openPanel === "no-identity" ? (
            <div
              css={`
                text-align: right;
              `}
            >
              <span {...getRootProps()}>
                <input {...getInputProps()} />
                <Button>
                  {isDragActive ? "Drop keypair.json" : "Use a keypair.json"}
                </Button>
              </span>
              {" or "}{" "}
              <Button
                onClick={() => {
                  const name = window.prompt(
                    "Please enter a shortname of exactly four lowercase letters",
                    ""
                  );

                  if (name === null) {
                    alert("You'll need to enter a name.");
                    return;
                  }

                  const keypair = generateAuthorKeypair(name);

                  if (isErr(keypair)) {
                    alert(keypair.message);
                    return;
                  }

                  setAuthor(keypair);
                  setOpenPanel(null);
                }}
              >
                Make a new one
              </Button>
            </div>
          ) : openPanel === "author-management" ? (
            <div
              css={`
                display: flex;
                flex-direction: column;
                align-items: flex-end;
              `}
            >
              <div>
                <TextInput
                  placeholder={"Enter a display name"}
                  value={newDisplayName}
                  onChange={(e) => {
                    setNewDisplayName(e.target.value);
                  }}
                />
                <Button
                  onClick={() => {
                    setOpenPanel(null);
                    setDisplayName();
                  }}
                >
                  Set display name
                </Button>
              </div>
              <p>or</p>
              <Button onClick={download}>Download your keypair.json</Button>
            </div>
          ) : (
            <div
              css={`
                text-align: right;
              `}
            >
              <Button onClick={() => setOpenPanel("author-management")}>
                Manage your identity
              </Button>
              {" or "}
              <Button
                onClick={() => {
                  setAuthor(null);
                  setOpenPanel(null);
                }}
              >
                Sign out
              </Button>
            </div>
          )}
        </ContextualPanel>
      ) : null}
      <MaxWidth>
        <div
          css={`
            display: flex;
            justify-content: space-between;
            padding: 12px 8px;
            align-items: baseline;
          `}
        >
          <div ref={workspaceNameRef}>
            {/* Animate the text whenever the value changes to draw the eye */}
            <WindupChildren>
              {tempMessage ? (
                tempMessage
              ) : (
                <NavButton
                  onClick={() =>
                    setOpenPanel((prev) => {
                      if (prev === "workspace") {
                        return null;
                      }
                      return "workspace";
                    })
                  }
                  accent={"alpha"}
                >
                  {`+${workspace.name}`}
                  <span
                    css={css`
                      color: ${(props) => props.theme.colours.alphaLine};
                    `}
                  >
                    {isSyncing
                      ? " is syncing..."
                      : hasLocalWorkspaceChanges
                      ? " has unsynced changes"
                      : null}
                  </span>
                </NavButton>
              )}
            </WindupChildren>
          </div>
          <div
            css={`
              display: flex;
            `}
          >
            <div
              ref={authorRef}
              css={`
                margin-right: 4px;
              `}
            >
              {/* Animate the text whenever the value changes to draw the eye */}
              <WindupChildren>
                <NavButton
                  onClick={() =>
                    setOpenPanel((prev) => {
                      const authGroup = [
                        "author",
                        "no-identity",
                        "author-management",
                      ] as Panel[];

                      if (prev !== null && authGroup.includes(prev)) {
                        return null;
                      }

                      return author ? "author" : "no-identity";
                    })
                  }
                  css={{ marginRight: 4 }}
                  accent={"beta"}
                  title={author ? author.address : undefined}
                >
                  {author
                    ? getAuthorShortname(author.address)
                    : "Not Signed In"}
                </NavButton>
                {author ? <AuthorIdenticon address={author.address} /> : null}
              </WindupChildren>
            </div>
            {/* Welcome to the new millennium */}
            <InternetClock />
          </div>
        </div>
      </MaxWidth>
    </div>
  );
};

// This declares which data StatusBar wants from Relay
export default createFragmentContainer(StatusBar, {
  workspace: graphql`
    fragment StatusBar_workspace on Workspace {
      address
      name
    }
  `,
});

function InternetClock() {
  const time = useInternetTime({ fractional: true });

  return (
    <div
      css={css`
        font-feature-settings: "tnum";
        font-variant-numeric: tabular-nums;
        color: ${(props) => props.theme.colours.fgHint};
      `}
    >
      {time}
    </div>
  );
}
