# Commit subject format, shared by the commit-msg hook and the CI check so the two
# cannot drift apart. Sourced, not executed.

commit_msg_type_regex='build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test'
commit_msg_scope_regex='.{1,20}'
commit_msg_description_regex='.{1,100}'
commit_msg_regex="^(${commit_msg_type_regex})(\(${commit_msg_scope_regex}\))?: (${commit_msg_description_regex})\$"

# Messages git and the GitHub merge button write for us. Not ours to format.
merge_msg_regex="^(Merge (branch|pull request|remote-tracking branch) .+|Revert \".+\")\$"

# Usage: subject_is_valid "<subject line>"
subject_is_valid() {
  [[ "$1" =~ (${commit_msg_regex})|(${merge_msg_regex}) ]]
}

commit_msg_help() {
  echo "Commit subjects must read:  <type>(<optional scope>): <description>"
  echo
  echo "  type         one of: ${commit_msg_type_regex//|/, }"
  echo "  scope        optional, 1-20 characters in parentheses"
  echo "  description  1-100 characters"
  echo
  echo "For example:  fix(cardview): stop the read indicator flickering on redraw"
}
