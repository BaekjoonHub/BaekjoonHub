import {filter} from './../../scripts/util'

test("filter sanity test", () => {
    let arr = [
        {
            "a": "hi",
            "b": "hi"
        },
        {
            "a": "bye",
            "b": "bye"
        }
    ]

    // test single filter condition
    expect(filter(arr, {"a": "notValidKey"}).length).toBe(0);
    expect(filter(arr, {"a": "hi"}).length).toBe(1);
    
    // test multiple filter conditions
    expect(filter(arr, {"a": "hi", "b": "hi"}).length).toBe(1);
    expect(filter(arr, {"a": "hi", "b": "bye"}).length).toBe(0);
})